import {
  providerIds,
  providers,
  type CustomStyleId,
  type CustomPromptStyle,
  type PromptStyle,
  type PromptStyleId,
  type ProviderId,
} from '@skim-page/core';
import {
  createCustomStyle,
  deleteCustomStyle,
  hasOpenAiApiKey,
  loadPromptStyleCatalog,
  loadOpenAiSettings,
  loadSettings,
  removeOpenAiApiKey,
  saveOpenAiApiKey,
  saveOpenAiSettings,
  saveSettings,
  updateCustomStyle,
} from './settings';
import './options.css';

const REFRESH_CONTEXT_MENUS_MESSAGE = 'skim-page:refresh-context-menus';
const TEST_OPENAI_KEY_MESSAGE = 'skim-page:test-openai-key';

const form = requireElement<HTMLFormElement>('#settings-form');
const openAiForm = requireElement<HTMLFormElement>('#openai-form');
const customStyleForm = requireElement<HTMLFormElement>('#custom-style-form');
const styleSelect = requireElement<HTMLSelectElement>('#style-select');
const providerSelect = requireElement<HTMLSelectElement>('#provider-select');
const customTitleInput = requireElement<HTMLInputElement>('#custom-title');
const customPromptInput = requireElement<HTMLTextAreaElement>('#custom-prompt');
const customSubmitButton = requireElement<HTMLButtonElement>('#custom-submit');
const customCancelButton = requireElement<HTMLButtonElement>('#custom-cancel');
const customStyleList = requireElement<HTMLDivElement>('#custom-style-list');
const statusElement = requireElement<HTMLParagraphElement>('#status');
const openAiKeyInput = requireElement<HTMLInputElement>('#openai-api-key');
const openAiModelSelect = requireElement<HTMLSelectElement>('#openai-model-select');
const openAiModelCustomInput = requireElement<HTMLInputElement>('#openai-model-custom');
const inPageEnabledInput = requireElement<HTMLInputElement>('#in-page-enabled');
const webSearchEnabledInput = requireElement<HTMLInputElement>('#web-search-enabled');
const testOpenAiKeyButton = requireElement<HTMLButtonElement>('#test-openai-key');
const removeOpenAiKeyButton = requireElement<HTMLButtonElement>('#remove-openai-key');
const openAiStatusElement = requireElement<HTMLParagraphElement>('#openai-status');

const MODEL_OPTION_VALUES = new Set(['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.5', 'gpt-5', 'gpt-5-mini']);

let styles: PromptStyle[] = [];
let customStyles: CustomPromptStyle[] = [];
let editingStyleId: CustomStyleId | null = null;
let statusTimer: ReturnType<typeof window.setTimeout> | null = null;
let openAiStatusTimer: ReturnType<typeof window.setTimeout> | null = null;

void hydrateSettings();

form.addEventListener('submit', (event) => {
  event.preventDefault();
  void persistSettings();
});

customStyleForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void saveCustomStyle();
});

openAiForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void persistOpenAiSettings();
});

testOpenAiKeyButton.addEventListener('click', () => {
  void testOpenAiKeyFromOptions();
});

removeOpenAiKeyButton.addEventListener('click', () => {
  void removeOpenAiKeyFromOptions();
});

openAiModelSelect.addEventListener('change', () => {
  syncCustomModelInputVisibility();
});

customStyleList.addEventListener('click', (event) => {
  const button = event.target instanceof HTMLElement ? event.target.closest('button') : null;
  const styleId = button?.dataset.styleId;

  if (!styleId) {
    return;
  }

  if (button?.dataset.action === 'edit') {
    startEditingCustomStyle(styleId as CustomStyleId);
  } else if (button?.dataset.action === 'delete') {
    void removeCustomStyle(styleId as CustomStyleId);
  }
});

customCancelButton.addEventListener('click', () => {
  resetCustomStyleForm();
});

function renderOptions(): void {
  styleSelect.replaceChildren(
    ...styles.map((style) => new Option(formatStyleOption(style), style.id)),
  );
  providerSelect.replaceChildren(
    ...providerIds.map((providerId) => new Option(providers[providerId].label, providerId)),
  );
}

async function hydrateSettings(): Promise<void> {
  const [settings, catalog, openAiSettings, hasKey] = await Promise.all([
    loadSettings(),
    loadPromptStyleCatalog(),
    loadOpenAiSettings(),
    hasOpenAiApiKey(),
  ]);
  styles = catalog.styles;
  customStyles = catalog.customStyles;

  renderOptions();
  renderCustomStyles(customStyles);
  styleSelect.value = settings.styleId;
  providerSelect.value = settings.providerId;
  setOpenAiModelValue(openAiSettings.openaiModel);
  inPageEnabledInput.checked = openAiSettings.inPageModeEnabled;
  webSearchEnabledInput.checked = openAiSettings.openaiWebSearchEnabled;
  openAiKeyInput.placeholder = hasKey ? 'Saved locally' : 'sk-...';
}

async function persistSettings(): Promise<void> {
  const styleId = styleSelect.value as PromptStyleId;
  const providerId = providerSelect.value as ProviderId;
  const style = styles.find((item) => item.id === styleId);

  await saveSettings({ styleId, providerId });
  showStatus(`Saved ${style?.title ?? 'Summary'} + ${providers[providerId].label}.`);
}

async function persistOpenAiSettings(): Promise<void> {
  const apiKey = openAiKeyInput.value.trim();

  if (apiKey) {
    await saveOpenAiApiKey(apiKey);
    openAiKeyInput.value = '';
  }

  await saveOpenAiSettings({
    inPageModeEnabled: inPageEnabledInput.checked,
    openaiModel: getOpenAiModelValue(),
    openaiWebSearchEnabled: webSearchEnabledInput.checked,
  });
  await requestContextMenuRefresh();
  await hydrateSettings();
  showOpenAiStatus(apiKey ? 'Saved local key and API settings.' : 'Saved API settings.', {
    tone: 'success',
  });
}

async function testOpenAiKeyFromOptions(): Promise<void> {
  await persistOpenAiSettings();
  showOpenAiStatus('Testing key...', { tone: 'neutral' });

  const response = (await chrome.runtime.sendMessage({
    model: getOpenAiModelValue(),
    type: TEST_OPENAI_KEY_MESSAGE,
  })) as { ok?: boolean; error?: string } | undefined;

  showOpenAiStatus(response?.ok ? 'OpenAI key works.' : response?.error ?? 'Key test failed.', {
    persist: true,
    tone: response?.ok ? 'success' : 'error',
  });
}

async function removeOpenAiKeyFromOptions(): Promise<void> {
  await removeOpenAiApiKey();
  await saveOpenAiSettings({ inPageModeEnabled: false });
  await requestContextMenuRefresh();
  await hydrateSettings();
  showOpenAiStatus('Removed local API key.', { tone: 'success' });
}

async function saveCustomStyle(): Promise<void> {
  const currentStyleId = styleSelect.value as PromptStyleId;

  if (editingStyleId) {
    const updatedStyle = await updateCustomStyle(editingStyleId, {
      title: customTitleInput.value,
      prompt: customPromptInput.value,
    });

    resetCustomStyleForm();
    await hydrateSettings();
    styleSelect.value = currentStyleId;
    await requestContextMenuRefresh();
    showStatus(updatedStyle ? `Updated ${updatedStyle.title}.` : 'Custom style was not found.');
    return;
  }

  const nextStyle = await createCustomStyle(customTitleInput.value, customPromptInput.value);

  resetCustomStyleForm();
  await hydrateSettings();
  styleSelect.value = currentStyleId;
  await requestContextMenuRefresh();
  showStatus(`Added ${nextStyle.title}.`);
}

async function removeCustomStyle(styleId: CustomStyleId): Promise<void> {
  await deleteCustomStyle(styleId);
  resetCustomStyleForm();
  await hydrateSettings();
  await requestContextMenuRefresh();
  showStatus('Custom style removed.');
}

function startEditingCustomStyle(styleId: CustomStyleId): void {
  const style = customStyles.find((item) => item.id === styleId);

  if (!style) {
    return;
  }

  editingStyleId = style.id;
  customTitleInput.value = style.title;
  customPromptInput.value = style.prompt;
  customSubmitButton.textContent = 'Save changes';
  customCancelButton.classList.remove('is-hidden');
  customTitleInput.focus();
}

function resetCustomStyleForm(): void {
  editingStyleId = null;
  customStyleForm.reset();
  customSubmitButton.textContent = 'Add custom style';
  customCancelButton.classList.add('is-hidden');
}

function setOpenAiModelValue(model: string): void {
  if (MODEL_OPTION_VALUES.has(model)) {
    openAiModelSelect.value = model;
    openAiModelCustomInput.value = '';
  } else {
    openAiModelSelect.value = 'custom';
    openAiModelCustomInput.value = model;
  }

  syncCustomModelInputVisibility();
}

function getOpenAiModelValue(): string {
  if (openAiModelSelect.value === 'custom') {
    return openAiModelCustomInput.value.trim();
  }

  return openAiModelSelect.value;
}

function syncCustomModelInputVisibility(): void {
  const isCustom = openAiModelSelect.value === 'custom';
  openAiModelCustomInput.classList.toggle('is-hidden', !isCustom);

  if (isCustom) {
    openAiModelCustomInput.focus();
  }
}

function renderCustomStyles(customStyles: CustomPromptStyle[]): void {
  if (customStyles.length === 0) {
    customStyleList.replaceChildren(renderEmptyState());
    return;
  }

  customStyleList.replaceChildren(...customStyles.map(renderCustomStyleItem));
}

function renderCustomStyleItem(style: CustomPromptStyle): HTMLElement {
  const item = document.createElement('article');
  const title = document.createElement('h3');
  const prompt = document.createElement('p');
  const actionGroup = document.createElement('div');
  const editButton = document.createElement('button');
  const deleteButton = document.createElement('button');

  item.className = 'custom-style-item';
  actionGroup.className = 'custom-style-actions';
  title.textContent = style.title;
  prompt.textContent = style.prompt;
  editButton.type = 'button';
  editButton.textContent = 'Edit';
  editButton.dataset.action = 'edit';
  editButton.dataset.styleId = style.id;
  editButton.className = 'button-secondary';
  deleteButton.type = 'button';
  deleteButton.textContent = 'Delete';
  deleteButton.dataset.action = 'delete';
  deleteButton.dataset.styleId = style.id;
  deleteButton.className = 'button-secondary';
  actionGroup.append(editButton, deleteButton);

  item.append(title, prompt, actionGroup);

  return item;
}

function renderEmptyState(): HTMLElement {
  const emptyState = document.createElement('p');
  emptyState.className = 'empty-state';
  emptyState.textContent = 'No custom styles yet.';

  return emptyState;
}

function formatStyleOption(style: PromptStyle): string {
  return style.source === 'custom' ? `${style.title} (Custom)` : style.title;
}

function showStatus(message: string): void {
  if (statusTimer) {
    window.clearTimeout(statusTimer);
  }

  statusElement.textContent = message;
  statusTimer = window.setTimeout(() => {
    statusElement.textContent = '';
    statusTimer = null;
  }, 2200);
}

function showOpenAiStatus(
  message: string,
  { persist = false, tone = 'neutral' }: { persist?: boolean; tone?: 'neutral' | 'success' | 'error' } = {},
): void {
  if (openAiStatusTimer) {
    window.clearTimeout(openAiStatusTimer);
    openAiStatusTimer = null;
  }

  openAiStatusElement.textContent = message;
  openAiStatusElement.classList.toggle('subtle-status-success', tone === 'success');
  openAiStatusElement.classList.toggle('subtle-status-error', tone === 'error');

  if (persist) {
    return;
  }

  openAiStatusTimer = window.setTimeout(() => {
    openAiStatusElement.textContent = '';
    openAiStatusElement.classList.remove('subtle-status-success', 'subtle-status-error');
    openAiStatusTimer = null;
  }, 3200);
}

async function requestContextMenuRefresh(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: REFRESH_CONTEXT_MENUS_MESSAGE });
  } catch {
    // The next extension startup/reload will rebuild menus if the worker is asleep.
  }
}

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Options page is missing ${selector}.`);
  }

  return element;
}
