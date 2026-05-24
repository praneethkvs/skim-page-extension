import { buildProviderHandoffUrl, buildStyleUrlPrompt, providers } from '@skim-page/core';
import { injectPanel } from './panelInjection';
import { hasOpenAiApiKey, loadPromptStyle, loadSettings } from './settings';
import './popup.css';

const defaultStyleElement = requireElement<HTMLElement>('#default-style');
const defaultProviderElement = requireElement<HTMLElement>('#default-provider');
const pageTitleElement = requireElement<HTMLElement>('#page-title');
const pageUrlElement = requireElement<HTMLParagraphElement>('#page-url');
const summarizeInPageButton = requireElement<HTMLButtonElement>('#summarize-in-page');
const summarizePageButton = requireElement<HTMLButtonElement>('#summarize-page');
const openOptionsButton = requireElement<HTMLButtonElement>('#open-options');
const statusElement = requireElement<HTMLParagraphElement>('#popup-status');

void hydratePopup();

summarizeInPageButton.addEventListener('click', () => {
  void summarizeCurrentPageInPanel();
});

summarizePageButton.addEventListener('click', () => {
  void openCurrentPageInProvider();
});

openOptionsButton.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

async function hydratePopup(): Promise<void> {
  const [settings, tab, hasKey] = await Promise.all([loadSettings(), loadActiveTab(), hasOpenAiApiKey()]);
  const style = await loadPromptStyle(settings.styleId);

  defaultStyleElement.textContent = style.title;
  defaultProviderElement.textContent = providers[settings.providerId].label;
  renderActiveTab(tab, hasKey && settings.inPageModeEnabled);
}

async function summarizeCurrentPageInPanel(): Promise<void> {
  const tab = await loadActiveTab();
  const [settings, hasKey] = await Promise.all([loadSettings(), hasOpenAiApiKey()]);

  if (!hasKey || !settings.inPageModeEnabled) {
    await chrome.runtime.openOptionsPage();
    return;
  }

  if (!isSummarizableUrl(tab?.url) || !tab.id) {
    showStatus('Open a regular webpage first.');
    return;
  }

  await injectPanel(tab.id, {
    kind: 'page',
    model: settings.openaiModel,
    webSearchEnabled: settings.openaiWebSearchEnabled,
  });
  window.close();
}

async function openCurrentPageInProvider(): Promise<void> {
  const tab = await loadActiveTab();

  if (!isSummarizableUrl(tab?.url)) {
    showStatus('Open a regular webpage first.');
    return;
  }

  const settings = await loadSettings();
  const style = await loadPromptStyle(settings.styleId);
  const prompt = buildStyleUrlPrompt(style, tab.url);

  await chrome.tabs.create({
    url: buildProviderHandoffUrl(settings.providerId, prompt),
  });
  window.close();
}

async function loadActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  return tab;
}

function renderActiveTab(tab: chrome.tabs.Tab | undefined, canSummarizeInPage: boolean): void {
  pageTitleElement.textContent = tab?.title || 'No page detected';
  pageUrlElement.textContent = tab?.url || '';

  if (!isSummarizableUrl(tab?.url)) {
    summarizeInPageButton.disabled = true;
    summarizePageButton.disabled = true;
    showStatus('Open a regular webpage to summarize.');
    return;
  }

  if (!canSummarizeInPage) {
    summarizeInPageButton.textContent = 'Set up in-page summaries';
  }
}

function isSummarizableUrl(url: string | undefined): url is string {
  return Boolean(url && /^https?:\/\//i.test(url));
}

function showStatus(message: string): void {
  statusElement.textContent = message;
}

function requireElement<TElement extends Element>(selector: string): TElement {
  const element = document.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Popup is missing ${selector}.`);
  }

  return element;
}
