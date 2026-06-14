import {
  buildProviderHandoffUrl,
  buildStyleSelectedTextPrompt,
  buildStyleUrlPrompt,
  lensIds,
  providerIds,
  providers,
  type CustomStyleId,
  type LensId,
  type PromptStyle,
  type PromptStyleId,
  type ProviderId,
} from '@skim-page/core';
import { injectPanel } from './panelInjection';
import { hasOpenAiApiKey, loadPromptStyle, loadPromptStyleCatalog, loadSettings } from './settings';

type PromptSource = 'page' | 'selection';
type MenuStyleId = LensId | CustomStyleId;

const MENU_PREFIX = 'skim-page';

let registrationQueue = Promise.resolve();

export function registerContextMenus(): void {
  registrationQueue = registrationQueue
    .then(rebuildContextMenus)
    .catch((error: unknown) => {
      console.error('Failed to register skim.page context menus.', error);
    });
}

export function refreshContextMenus(): void {
  registerContextMenus();
}

export function listenForContextMenuClicks(): void {
  chrome.contextMenus.onClicked.addListener((info) => {
    void handleContextMenuClick(info);
  });
}

async function handleContextMenuClick(info: chrome.contextMenus.OnClickData): Promise<void> {
  const parsedMenuId = parseMenuId(String(info.menuItemId));

  if (!parsedMenuId) {
    return;
  }

  if (parsedMenuId.kind === 'setup') {
    await chrome.runtime.openOptionsPage();
    return;
  }

  if (parsedMenuId.kind === 'in-page') {
    await openInPagePanel(parsedMenuId.source, parsedMenuId.styleId, info);
    return;
  }

  if (parsedMenuId.kind === 'prompt-first') {
    await openPromptFirstPanel(info);
    return;
  }

  await openProviderHandoff(parsedMenuId, info);
}

async function openProviderHandoff(
  parsedMenuId:
    | { kind: 'settings'; source: PromptSource }
    | { kind: 'provider'; source: PromptSource; styleId: MenuStyleId; providerId: ProviderId },
  info: chrome.contextMenus.OnClickData,
): Promise<void> {
  const settings =
    parsedMenuId.kind === 'settings'
      ? await loadSettings()
      : { styleId: parsedMenuId.styleId, providerId: parsedMenuId.providerId };
  const style = await loadPromptStyle(settings.styleId);
  const prompt = buildPromptForSource(parsedMenuId.source, style, info);

  if (!prompt) {
    return;
  }

  await chrome.tabs.create({
    url: buildProviderHandoffUrl(settings.providerId, prompt),
  });
}

async function openInPagePanel(
  source: PromptSource,
  styleId: MenuStyleId | 'default',
  info: chrome.contextMenus.OnClickData,
): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const settings = await loadSettings();
  const tabId = tab?.id;

  if (!tabId) {
    return;
  }

  if (source === 'selection') {
    const selectedText = info.selectionText?.trim();

    if (!selectedText || !info.pageUrl) {
      return;
    }

    await injectPanel(tabId, {
      kind: 'selection',
      model: settings.openaiModel,
      mode: 'summarize',
      styleId,
      text: selectedText,
      title: tab.title,
      url: info.pageUrl,
      webSearchEnabled: settings.openaiWebSearchEnabled,
    });
    return;
  }

  await injectPanel(tabId, {
    kind: 'page',
    model: settings.openaiModel,
    styleId,
    webSearchEnabled: settings.openaiWebSearchEnabled,
  });
}

async function openPromptFirstPanel(info: chrome.contextMenus.OnClickData): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const settings = await loadSettings();
  const selectedText = info.selectionText?.trim();

  if (!tab?.id || !selectedText || !info.pageUrl) {
    return;
  }

  await injectPanel(tab.id, {
    kind: 'selection',
    model: settings.openaiModel,
    mode: 'prompt-first',
    text: selectedText,
    title: tab.title,
    url: info.pageUrl,
    webSearchEnabled: settings.openaiWebSearchEnabled,
  });
}

async function rebuildContextMenus(): Promise<void> {
  const [catalog, settings, hasKey] = await Promise.all([
    loadPromptStyleCatalog(),
    loadSettings(),
    hasOpenAiApiKey(),
  ]);
  const canSummarizeInPage = hasKey && settings.inPageModeEnabled;
  await removeAllContextMenus();

  createMenuTree('selection', catalog.styles, canSummarizeInPage);
  createMenuTree('page', catalog.styles, canSummarizeInPage);
}

function createMenuTree(
  source: PromptSource,
  styles: PromptStyle[],
  canSummarizeInPage: boolean,
): void {
  const rootId = buildRootMenuId(source);

  createContextMenu({
    id: rootId,
    title: 'skim.page',
    contexts: [source],
  });

  if (canSummarizeInPage) {
    if (source === 'selection') {
      createContextMenu({
        id: buildPromptFirstMenuId(source),
        parentId: rootId,
        title: 'Ask Anything',
        contexts: [source],
      });
    }

    const inPageRootId = buildBranchMenuId(source, 'in-page');
    createContextMenu({
      id: inPageRootId,
      parentId: rootId,
      title: 'Summarize',
      contexts: [source],
    });
    createContextMenu({
      id: buildInPageDefaultMenuId(source),
      parentId: inPageRootId,
      title: 'Use my defaults',
      contexts: [source],
    });
    createInPageStyleMenus(source, styles, inPageRootId);
  } else {
    createContextMenu({
      id: buildSetupMenuId(source),
      parentId: rootId,
      title: 'Set up in-page summaries',
      contexts: [source],
    });
  }

  const providerRootId = buildBranchMenuId(source, 'provider');
  createContextMenu({
    id: providerRootId,
    parentId: rootId,
    title: 'Open in AI assistant',
    contexts: [source],
  });
  createContextMenu({
    id: buildDefaultMenuId(source),
    parentId: providerRootId,
    title: 'Use my defaults',
    contexts: [source],
  });
  createGroupedStyleMenus(source, styles, providerRootId, 'provider');
}

function createInPageStyleMenus(source: PromptSource, styles: PromptStyle[], parentId: string): void {
  const customStyles = styles.filter((style) => style.source === 'custom');
  const builtInStyles = styles.filter((style) => style.source === 'built-in');

  createStyleMenus(source, customStyles, parentId, 'in-page');

  const builtInGroupId = buildGroupMenuId(source, 'in-page', 'built-in');

  createContextMenu({
    id: builtInGroupId,
    parentId,
    title: 'Built-in styles',
    contexts: [source],
  });
  createStyleMenus(source, builtInStyles, builtInGroupId, 'in-page');
}

function createGroupedStyleMenus(
  source: PromptSource,
  styles: PromptStyle[],
  parentId: string,
  branch: 'in-page' | 'provider',
): void {
  const customStyles = styles.filter((style) => style.source === 'custom');
  const builtInStyles = styles.filter((style) => style.source === 'built-in');

  if (customStyles.length > 0) {
    const customGroupId = buildGroupMenuId(source, branch, 'custom');

    createContextMenu({
      id: customGroupId,
      parentId,
      title: 'Custom styles',
      contexts: [source],
    });
    createStyleMenus(source, customStyles, customGroupId, branch);
  }

  const builtInGroupId = buildGroupMenuId(source, branch, 'built-in');

  createContextMenu({
    id: builtInGroupId,
    parentId,
    title: 'Built-in styles',
    contexts: [source],
  });
  createStyleMenus(source, builtInStyles, builtInGroupId, branch);
}

function createStyleMenus(
  source: PromptSource,
  styles: PromptStyle[],
  parentId: string,
  branch: 'in-page' | 'provider',
): void {
  styles.forEach((style) => {
    if (branch === 'in-page') {
      createContextMenu({
        id: buildInPageStyleMenuId(source, style.id),
        parentId,
        title: style.title,
        contexts: [source],
      });
      return;
    }

    const styleMenuId = buildProviderStyleMenuId(source, style.id);

    createContextMenu({
      id: styleMenuId,
      parentId,
      title: style.title,
      contexts: [source],
    });

    providerIds.forEach((providerId) => {
      createContextMenu({
        id: buildProviderMenuId(source, style.id, providerId),
        parentId: styleMenuId,
        title: providers[providerId].label,
        contexts: [source],
      });
    });
  });
}

function removeAllContextMenus(): Promise<void> {
  return new Promise((resolve) => {
    chrome.contextMenus.removeAll(resolve);
  });
}

function createContextMenu(createProperties: chrome.contextMenus.CreateProperties): void {
  chrome.contextMenus.create(createProperties, () => {
    if (chrome.runtime.lastError) {
      console.warn('Skipping skim.page context menu item.', chrome.runtime.lastError.message);
    }
  });
}

function buildPromptForSource(
  source: PromptSource,
  style: PromptStyle,
  info: chrome.contextMenus.OnClickData,
): string | null {
  if (source === 'selection') {
    const selectedText = info.selectionText?.trim();

    return selectedText ? buildStyleSelectedTextPrompt(style, selectedText, info.pageUrl) : null;
  }

  return info.pageUrl ? buildStyleUrlPrompt(style, info.pageUrl) : null;
}

function buildRootMenuId(source: PromptSource): string {
  return `${MENU_PREFIX}:${source}`;
}

function buildBranchMenuId(source: PromptSource, branch: 'in-page' | 'provider'): string {
  return `${MENU_PREFIX}:${source}:${branch}`;
}

function buildSetupMenuId(source: PromptSource): string {
  return `${MENU_PREFIX}:${source}:setup-in-page`;
}

function buildDefaultMenuId(source: PromptSource): string {
  return `${MENU_PREFIX}:${source}:provider:default`;
}

function buildInPageDefaultMenuId(source: PromptSource): string {
  return `${MENU_PREFIX}:${source}:in-page:default`;
}

function buildPromptFirstMenuId(source: PromptSource): string {
  return `${MENU_PREFIX}:${source}:in-page:prompt-first`;
}

function buildGroupMenuId(
  source: PromptSource,
  branch: 'in-page' | 'provider',
  group: 'built-in' | 'custom',
): string {
  return `${MENU_PREFIX}:${source}:${branch}:${group}`;
}

function buildInPageStyleMenuId(source: PromptSource, styleId: PromptStyleId): string {
  return `${MENU_PREFIX}:${source}:in-page:style:${encodeMenuPart(styleId)}`;
}

function buildProviderStyleMenuId(source: PromptSource, styleId: PromptStyleId): string {
  return `${MENU_PREFIX}:${source}:provider:style:${encodeMenuPart(styleId)}`;
}

function buildProviderMenuId(
  source: PromptSource,
  styleId: PromptStyleId,
  providerId: ProviderId,
): string {
  return `${MENU_PREFIX}:${source}:provider:style:${encodeMenuPart(styleId)}:${providerId}`;
}

function parseMenuId(menuId: string):
  | { kind: 'settings'; source: PromptSource }
  | { kind: 'setup'; source: PromptSource }
  | { kind: 'prompt-first'; source: 'selection' }
  | { kind: 'in-page'; source: PromptSource; styleId: MenuStyleId | 'default' }
  | { kind: 'provider'; source: PromptSource; styleId: MenuStyleId; providerId: ProviderId }
  | null {
  const parts = menuId.split(':');
  const [, source, branch, action, encodedStyleId, providerId] = parts;

  if (!isPromptSource(source)) {
    return null;
  }

  if (branch === 'setup-in-page') {
    return { kind: 'setup', source };
  }

  if (branch === 'provider' && action === 'default') {
    return { kind: 'settings', source };
  }

  if (branch === 'in-page' && action === 'default') {
    return { kind: 'in-page', source, styleId: 'default' };
  }

  if (branch === 'in-page' && action === 'prompt-first' && source === 'selection') {
    return { kind: 'prompt-first', source };
  }

  if (branch === 'in-page' && action === 'style') {
    const styleId = decodeMenuPart(encodedStyleId);

    return isMenuStyleId(styleId) ? { kind: 'in-page', source, styleId } : null;
  }

  if (branch === 'provider' && action === 'style') {
    const styleId = decodeMenuPart(encodedStyleId);

    return isMenuStyleId(styleId) && isProviderId(providerId)
      ? { kind: 'provider', source, styleId, providerId }
      : null;
  }

  return null;
}

function isPromptSource(value: string | undefined): value is PromptSource {
  return value === 'page' || value === 'selection';
}

function isMenuStyleId(value: string | undefined): value is MenuStyleId {
  return Boolean(value && (lensIds.includes(value as LensId) || value.startsWith('custom:')));
}

function isProviderId(value: string | undefined): value is ProviderId {
  return Boolean(value && providerIds.includes(value as ProviderId));
}

function encodeMenuPart(value: string): string {
  return encodeURIComponent(value);
}

function decodeMenuPart(value: string | undefined): string {
  if (!value) {
    return '';
  }

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
