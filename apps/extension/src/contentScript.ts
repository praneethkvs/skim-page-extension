import type { PromptStyleId } from '@skim-page/core';

type PanelSourceRequest =
  | { kind: 'page'; model?: string; styleId?: PromptStyleId; webSearchEnabled?: boolean }
  | {
      kind: 'selection';
      model?: string;
      mode?: 'prompt-first' | 'summarize';
      styleId?: PromptStyleId | 'default';
      text: string;
      url: string;
      title?: string;
      webSearchEnabled?: boolean;
    };

type SummarySource =
  | { kind: 'selection'; url: string; title?: string; text: string }
  | { kind: 'pageText'; url: string; title?: string; text: string }
  | { kind: 'url'; url: string; title?: string };

type ChatItem = {
  role: 'assistant' | 'user';
  content: string;
};

type VisibleConversationItem =
  | ChatItem
  | {
      role: 'notice';
      content: string;
    };

const PANEL_ID = 'skim-page-panel-root';
const OPEN_PANEL_MESSAGE = 'skim-page:open-panel';
const SUMMARIZE_MESSAGE = 'skim-page:summarize';
const CANCEL_SUMMARY_MESSAGE = 'skim-page:cancel-summary';
const STREAM_DELTA_MESSAGE = 'skim-page:stream-delta';
const STREAM_DONE_MESSAGE = 'skim-page:stream-done';
const ERROR_MESSAGE = 'skim-page:error';
const MAX_PAGE_TEXT_CHARS = 14000;
const MIN_PAGE_TEXT_CHARS = 300;
const DEFAULT_PANEL_MODEL = 'gpt-5.4-mini';
const MODEL_OPTION_VALUES = new Set(['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.5', 'gpt-5', 'gpt-5-mini']);
const SLOW_SUMMARY_MS = 12000;
const SLOW_WEB_SEARCH_MS = 18000;
const LOCAL_SUMMARY_TIMEOUT_MS = 50000;
const LOCAL_WEB_SEARCH_TIMEOUT_MS = 80000;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BARE_URL_PATTERN = /https?:\/\/[^\s<>"')\]]+/g;

(globalThis as { __SKIM_PAGE_PANEL_READY__?: boolean }).__SKIM_PAGE_PANEL_READY__ = true;

let panel: HTMLElement | null = null;
let outputElement: HTMLDivElement | null = null;
let statusElement: HTMLParagraphElement | null = null;
let modelSelect: HTMLSelectElement | null = null;
let customModelInput: HTMLInputElement | null = null;
let webSearchInput: HTMLInputElement | null = null;
let followUpForm: HTMLFormElement | null = null;
let followUpInput: HTMLInputElement | null = null;
let currentSource: SummarySource | null = null;
let currentMode: 'prompt-first' | 'summarize' = 'summarize';
let currentModel = DEFAULT_PANEL_MODEL;
let currentWebSearchEnabled = false;
let currentStyleId: PromptStyleId | 'default' | undefined;
let currentResponse = '';
let conversationHistory: ChatItem[] = [];
let visibleConversation: VisibleConversationItem[] = [];
let activeAssistantIndex: number | null = null;
let activeFollowUp: string | undefined;
let lastFailedFollowUp: string | undefined;
let hasStartedConversation = false;
let slowTimer: ReturnType<typeof setTimeout> | null = null;
let localTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let isPanelCollapsed = false;
let dragState:
  | {
      offsetX: number;
      offsetY: number;
    }
  | null = null;

chrome.runtime.onMessage.addListener((message) => {
  if (isOpenPanelMessage(message)) {
    void openPanel(message.sourceRequest);
  } else if (isStreamDeltaMessage(message)) {
    appendDelta(message.delta);
  } else if (isStreamDoneMessage(message)) {
    finishResponse();
  } else if (isErrorMessage(message)) {
    showError(message.error);
  }
});

async function openPanel(sourceRequest: PanelSourceRequest): Promise<void> {
  ensurePanel();
  setPanelCollapsed(false);
  currentSource = buildSummarySource(sourceRequest);
  currentMode = sourceRequest.kind === 'selection' && sourceRequest.mode === 'prompt-first' ? 'prompt-first' : 'summarize';
  currentModel = sourceRequest.model?.trim() || DEFAULT_PANEL_MODEL;
  currentWebSearchEnabled = sourceRequest.webSearchEnabled ?? false;
  currentStyleId = sourceRequest.styleId;
  conversationHistory = [];
  visibleConversation = [];
  activeAssistantIndex = null;
  activeFollowUp = undefined;
  lastFailedFollowUp = undefined;
  hasStartedConversation = false;
  currentResponse = '';
  setPanelModelValue(currentModel);
  if (webSearchInput) {
    webSearchInput.checked = currentWebSearchEnabled;
  }
  setOutput('');

  if (sourceRequest.kind === 'selection' && sourceRequest.mode === 'prompt-first') {
    setStatus('Selected text is ready. Type your prompt and press Send.');
    setOutput(`Selected text:\n${sourceRequest.text}`);
    updateFollowUpPlaceholder();
    followUpInput?.focus();
    return;
  }

  setStatus(currentSource.kind === 'url' ? 'Using URL fallback.' : 'Summarizing...');
  await requestSummary();
}

function ensurePanel(): void {
  if (panel) {
    panel.classList.remove('skim-page-panel-hidden');
    return;
  }

  injectStyles();

  panel = document.createElement('section');
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <header class="skim-page-panel-header">
      <div>
        <p>skim.page</p>
        <h2>In-page summary</h2>
      </div>
      <div class="skim-page-window-actions">
        <button class="skim-page-icon-button" id="skim-page-collapse" type="button" aria-label="Collapse">-</button>
        <button class="skim-page-icon-button" id="skim-page-close" type="button" aria-label="Close">x</button>
      </div>
    </header>
    <p class="skim-page-status" id="skim-page-status"></p>
    <div class="skim-page-controls" aria-label="Summary settings">
      <div class="skim-page-control-group">
        <span class="skim-page-control-label">Model</span>
        <div class="skim-page-model-row">
          <label class="skim-page-select-wrap" aria-label="Model">
            <select id="skim-page-model-select">
              <option value="gpt-5.4-mini">gpt-5.4-mini</option>
              <option value="gpt-5.4">gpt-5.4</option>
              <option value="gpt-5.5">gpt-5.5</option>
              <option value="gpt-5">gpt-5</option>
              <option value="gpt-5-mini">gpt-5-mini</option>
              <option value="custom">Custom model...</option>
            </select>
          </label>
          <input class="skim-page-custom-model-input skim-page-hidden" id="skim-page-model-custom" placeholder="Enter model ID" />
        </div>
      </div>
      <label class="skim-page-web-search-field">
        <input id="skim-page-web-search" type="checkbox" />
        <span class="skim-page-switch" aria-hidden="true"></span>
        <span>Web</span>
      </label>
    </div>
    <div class="skim-page-output" id="skim-page-output"></div>
    <form class="skim-page-followup" id="skim-page-followup">
      <input id="skim-page-followup-input" placeholder="Ask anything about this text or article" />
      <button type="submit">Send</button>
    </form>
    <div class="skim-page-panel-actions">
      <button id="skim-page-copy" type="button">Copy</button>
      <button id="skim-page-regenerate" type="button">Regenerate</button>
      <button id="skim-page-provider" type="button">Open in provider</button>
    </div>
  `;
  document.documentElement.append(panel);

  outputElement = requirePanelElement<HTMLDivElement>('#skim-page-output');
  statusElement = requirePanelElement<HTMLParagraphElement>('#skim-page-status');
  modelSelect = requirePanelElement<HTMLSelectElement>('#skim-page-model-select');
  customModelInput = requirePanelElement<HTMLInputElement>('#skim-page-model-custom');
  webSearchInput = requirePanelElement<HTMLInputElement>('#skim-page-web-search');
  followUpForm = requirePanelElement<HTMLFormElement>('#skim-page-followup');
  followUpInput = requirePanelElement<HTMLInputElement>('#skim-page-followup-input');

  requirePanelElement<HTMLElement>('.skim-page-panel-header').addEventListener('pointerdown', startPanelDrag);
  requirePanelElement<HTMLButtonElement>('#skim-page-collapse').addEventListener('click', () => {
    setPanelCollapsed(!isPanelCollapsed);
  });
  requirePanelElement<HTMLButtonElement>('#skim-page-close').addEventListener('click', () => {
    void cancelActiveSummaryRequest();
    clearRequestTimers();
    panel?.classList.add('skim-page-panel-hidden');
  });
  requirePanelElement<HTMLButtonElement>('#skim-page-copy').addEventListener('click', () => {
    void navigator.clipboard.writeText(formatVisibleConversationForClipboard());
  });
  requirePanelElement<HTMLButtonElement>('#skim-page-regenerate').addEventListener('click', () => {
    currentResponse = '';
    removeLastNotice();

    if (lastFailedFollowUp) {
      void requestSummary(lastFailedFollowUp);
      return;
    }

    conversationHistory = [];
    visibleConversation = [];
    activeAssistantIndex = null;
    renderVisibleConversation();
    void requestSummary();
  });
  requirePanelElement<HTMLButtonElement>('#skim-page-provider').addEventListener('click', () => {
    window.open(`https://skim.page/${window.location.href}`, '_blank', 'noopener,noreferrer');
  });
  followUpForm.addEventListener('submit', (event) => {
    event.preventDefault();
    void askFollowUp();
  });
  modelSelect.addEventListener('change', () => {
    syncPanelCustomModelVisibility();
  });
}

async function requestSummary(followUp?: string): Promise<void> {
  if (!currentSource) {
    return;
  }

  hasStartedConversation = true;
  updateFollowUpPlaceholder();
  startRequestUi();
  currentResponse = '';
  lastFailedFollowUp = undefined;
  activeFollowUp = followUp;
  activeAssistantIndex = appendVisibleMessage({ role: 'assistant', content: '' });
  try {
    await chrome.runtime.sendMessage({
      type: SUMMARIZE_MESSAGE,
      followUp,
      history: conversationHistory,
      model: getPanelModel(),
      promptFirst: currentMode === 'prompt-first',
      source: currentSource,
      styleId: currentStyleId === 'default' ? undefined : currentStyleId,
      webSearchEnabled: getPanelWebSearchEnabled(),
    });
  } catch (error) {
    lastFailedFollowUp = followUp;
    showError(getErrorMessage(error));
  }
}

async function askFollowUp(): Promise<void> {
  const followUp = followUpInput?.value.trim();

  if (!followUp) {
    return;
  }

  conversationHistory.push({ role: 'user', content: followUp });
  appendVisibleMessage({ role: 'user', content: followUp });
  followUpInput!.value = '';
  await requestSummary(followUp);
}

function appendDelta(delta: string): void {
  currentResponse += delta;
  updateActiveAssistantMessage(currentResponse);
  setStatus('Writing...');
}

function finishResponse(): void {
  clearRequestTimers();

  if (!currentResponse) {
    lastFailedFollowUp = undefined;
    showError('OpenAI finished without returning a summary. Try again, or try a different model.');
    return;
  }

  if (currentResponse) {
    conversationHistory.push({ role: 'assistant', content: currentResponse });
  }

  activeAssistantIndex = null;
  activeFollowUp = undefined;
  lastFailedFollowUp = undefined;
  setStatus('Ready');
}

function showError(error: string): void {
  clearRequestTimers();
  setStatus('Could not finish');
  lastFailedFollowUp = activeFollowUp;
  activeFollowUp = undefined;
  removeActiveAssistantMessage();
  appendVisibleMessage({
    role: 'notice',
    content: `${error}\n\nYou can change model/search and retry, type a new follow-up, or open the prompt in your provider.`,
  });
  activeAssistantIndex = null;
}

function buildSummarySource(sourceRequest: PanelSourceRequest): SummarySource {
  if (sourceRequest.kind === 'selection') {
    return {
      kind: 'selection',
      text: sourceRequest.text,
      title: sourceRequest.title ?? document.title,
      url: sourceRequest.url,
    };
  }

  const text = extractVisibleText();

  if (text.length >= MIN_PAGE_TEXT_CHARS) {
    return {
      kind: 'pageText',
      text,
      title: document.title,
      url: window.location.href,
    };
  }

  return {
    kind: 'url',
    title: document.title,
    url: window.location.href,
  };
}

function extractVisibleText(): string {
  const sourceElement =
    document.querySelector('article') ?? document.querySelector('main') ?? document.body;
  const text = (sourceElement?.innerText ?? document.body.innerText)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return text.slice(0, MAX_PAGE_TEXT_CHARS);
}

function setStatus(status: string): void {
  if (statusElement) {
    statusElement.textContent = status;
  }
}

function setOutput(output: string): void {
  if (outputElement) {
    outputElement.textContent = output || 'Working on it...';
  }
}

function appendVisibleMessage(message: VisibleConversationItem): number {
  visibleConversation.push(message);
  renderVisibleConversation();

  return visibleConversation.length - 1;
}

function updateActiveAssistantMessage(content: string): void {
  if (activeAssistantIndex === null || !visibleConversation[activeAssistantIndex]) {
    activeAssistantIndex = appendVisibleMessage({ role: 'assistant', content });
    return;
  }

  visibleConversation[activeAssistantIndex] = { role: 'assistant', content };
  renderVisibleConversation();
}

function removeActiveAssistantMessage(): void {
  if (activeAssistantIndex === null) {
    return;
  }

  visibleConversation.splice(activeAssistantIndex, 1);
  activeAssistantIndex = null;
  renderVisibleConversation();
}

function removeLastNotice(): void {
  const lastItem = visibleConversation[visibleConversation.length - 1];

  if (lastItem?.role === 'notice') {
    visibleConversation.pop();
    renderVisibleConversation();
  }
}

function renderVisibleConversation(): void {
  if (!outputElement) {
    return;
  }

  if (visibleConversation.length === 0) {
    outputElement.textContent = 'Working on it...';
    return;
  }

  outputElement.replaceChildren(...visibleConversation.map(renderConversationMessage));
  outputElement.scrollTop = outputElement.scrollHeight;
}

function renderConversationMessage(message: VisibleConversationItem): HTMLElement {
  const article = document.createElement('article');
  const label = document.createElement('p');
  const body = document.createElement('div');

  article.className = `skim-page-message skim-page-message-${message.role}`;
  label.className = 'skim-page-message-label';
  label.textContent =
    message.role === 'assistant' ? 'skim.page' : message.role === 'user' ? 'You' : 'Notice';
  body.className = 'skim-page-message-body';
  renderRichText(body, message.content || 'Working on it...');
  article.append(label, body);

  return article;
}

function renderRichText(container: HTMLElement, text: string): void {
  container.replaceChildren();
  appendLinkedText(container, text, 0, text.length);
}

function appendLinkedText(container: HTMLElement, text: string, startIndex: number, endIndex: number): void {
  MARKDOWN_LINK_PATTERN.lastIndex = startIndex;
  let cursor = startIndex;

  while (true) {
    const match = MARKDOWN_LINK_PATTERN.exec(text);

    if (!match || match.index >= endIndex) {
      break;
    }

    const [rawLink, label, href] = match;

    if (match.index > cursor) {
      appendBareUrlText(container, text.slice(cursor, match.index));
    }

    container.append(createSafeLink(href, label));
    cursor = match.index + rawLink.length;
  }

  if (cursor < endIndex) {
    appendBareUrlText(container, text.slice(cursor, endIndex));
  }
}

function appendBareUrlText(container: HTMLElement, text: string): void {
  BARE_URL_PATTERN.lastIndex = 0;
  let cursor = 0;

  while (true) {
    const match = BARE_URL_PATTERN.exec(text);

    if (!match) {
      break;
    }

    const url = trimTrailingUrlPunctuation(match[0]);
    const urlEndIndex = match.index + url.length;

    if (match.index > cursor) {
      container.append(document.createTextNode(text.slice(cursor, match.index)));
    }

    container.append(createSafeLink(url, url));
    cursor = urlEndIndex;
  }

  if (cursor < text.length) {
    container.append(document.createTextNode(text.slice(cursor)));
  }
}

function trimTrailingUrlPunctuation(url: string): string {
  return url.replace(/[.,;:!?]+$/g, '');
}

function createSafeLink(href: string, label: string): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.textContent = label;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';

  return anchor;
}

function formatVisibleConversationForClipboard(): string {
  if (visibleConversation.length === 0) {
    return currentResponse;
  }

  return visibleConversation
    .map((message) => `${formatVisibleMessageLabel(message)}:\n${message.content}`)
    .join('\n\n');
}

function formatVisibleMessageLabel(message: VisibleConversationItem): string {
  if (message.role === 'assistant') {
    return 'skim.page';
  }

  if (message.role === 'user') {
    return 'You';
  }

  return 'Notice';
}

function updateFollowUpPlaceholder(): void {
  if (!followUpInput) {
    return;
  }

  followUpInput.placeholder = hasStartedConversation
    ? 'Ask a follow-up question'
    : 'Ask anything about this text or article';
}

function startRequestUi(): void {
  const webSearchEnabled = getPanelWebSearchEnabled();

  clearRequestTimers();
  setStatus('Thinking...');
  if (visibleConversation.length === 0) {
    setOutput('');
  }
  slowTimer = setTimeout(() => {
    setStatus(
      webSearchEnabled
        ? 'Searching the web. This can take a little longer...'
        : 'Still working. If this takes too long, skim.page will stop it.',
    );
  }, webSearchEnabled ? SLOW_WEB_SEARCH_MS : SLOW_SUMMARY_MS);
  localTimeoutTimer = setTimeout(() => {
    void cancelActiveSummaryRequest();
    showError(
      webSearchEnabled
        ? 'This web-search summary took too long, so skim.page stopped it.'
        : 'This summary took too long, so skim.page stopped it.',
    );
  }, webSearchEnabled ? LOCAL_WEB_SEARCH_TIMEOUT_MS : LOCAL_SUMMARY_TIMEOUT_MS);
}

function clearRequestTimers(): void {
  if (slowTimer) {
    clearTimeout(slowTimer);
    slowTimer = null;
  }

  if (localTimeoutTimer) {
    clearTimeout(localTimeoutTimer);
    localTimeoutTimer = null;
  }
}

async function cancelActiveSummaryRequest(): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: CANCEL_SUMMARY_MESSAGE });
  } catch {
    // The service worker may already have stopped or the tab may be closing.
  }
}

function getPanelModel(): string {
  const model =
    modelSelect?.value === 'custom' ? customModelInput?.value.trim() : modelSelect?.value.trim();

  return model || currentModel || DEFAULT_PANEL_MODEL;
}

function setPanelModelValue(model: string): void {
  if (!modelSelect || !customModelInput) {
    return;
  }

  if (MODEL_OPTION_VALUES.has(model)) {
    modelSelect.value = model;
    customModelInput.value = '';
  } else {
    modelSelect.value = 'custom';
    customModelInput.value = model;
  }

  syncPanelCustomModelVisibility();
}

function syncPanelCustomModelVisibility(): void {
  const isCustom = modelSelect?.value === 'custom';
  customModelInput?.classList.toggle('skim-page-hidden', !isCustom);

  if (isCustom) {
    customModelInput?.focus();
  }
}

function getPanelWebSearchEnabled(): boolean {
  return webSearchInput?.checked ?? currentWebSearchEnabled;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong before the request started.';
}

function setPanelCollapsed(collapsed: boolean): void {
  isPanelCollapsed = collapsed;
  panel?.classList.toggle('skim-page-panel-collapsed', collapsed);

  const collapseButton = panel?.querySelector<HTMLButtonElement>('#skim-page-collapse');

  if (collapseButton) {
    collapseButton.textContent = collapsed ? '+' : '-';
    collapseButton.setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');
  }

  requestAnimationFrame(clampPanelToViewport);
}

function startPanelDrag(event: PointerEvent): void {
  if (
    !panel ||
    event.button !== 0 ||
    (event.target instanceof HTMLElement && Boolean(event.target.closest('button')))
  ) {
    return;
  }

  const rect = panel.getBoundingClientRect();
  dragState = {
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };
  panel.classList.add('skim-page-panel-dragging');
  panel.style.left = `${rect.left}px`;
  panel.style.top = `${rect.top}px`;
  panel.style.right = 'auto';
  panel.style.bottom = 'auto';
  panel.setPointerCapture(event.pointerId);
  panel.addEventListener('pointermove', movePanel);
  panel.addEventListener('pointerup', stopPanelDrag);
  panel.addEventListener('pointercancel', stopPanelDrag);
}

function movePanel(event: PointerEvent): void {
  if (!panel || !dragState) {
    return;
  }

  const rect = panel.getBoundingClientRect();
  const nextLeft = clamp(event.clientX - dragState.offsetX, 8, window.innerWidth - rect.width - 8);
  const nextTop = clamp(event.clientY - dragState.offsetY, 8, window.innerHeight - rect.height - 8);

  panel.style.left = `${nextLeft}px`;
  panel.style.top = `${nextTop}px`;
}

function stopPanelDrag(event: PointerEvent): void {
  if (!panel) {
    return;
  }

  dragState = null;
  panel.classList.remove('skim-page-panel-dragging');
  if (panel.hasPointerCapture(event.pointerId)) {
    panel.releasePointerCapture(event.pointerId);
  }
  panel.removeEventListener('pointermove', movePanel);
  panel.removeEventListener('pointerup', stopPanelDrag);
  panel.removeEventListener('pointercancel', stopPanelDrag);
}

function clampPanelToViewport(): void {
  if (!panel || !panel.style.left || !panel.style.top) {
    return;
  }

  const rect = panel.getBoundingClientRect();
  const nextLeft = clamp(rect.left, 8, window.innerWidth - rect.width - 8);
  const nextTop = clamp(rect.top, 8, window.innerHeight - rect.height - 8);

  panel.style.left = `${nextLeft}px`;
  panel.style.top = `${nextTop}px`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function requirePanelElement<TElement extends Element>(selector: string): TElement {
  const element = panel?.querySelector<TElement>(selector);

  if (!element) {
    throw new Error(`Missing panel element ${selector}.`);
  }

  return element;
}

function injectStyles(): void {
  if (document.getElementById('skim-page-panel-style')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'skim-page-panel-style';
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483647;
      display: grid;
      gap: 12px;
      width: min(420px, calc(100vw - 36px));
      min-width: 0;
      max-height: min(680px, calc(100vh - 36px));
      padding: 16px;
      border: 1px solid #dedede;
      border-radius: 10px;
      background: #fff;
      box-shadow: 0 20px 60px rgba(17, 17, 17, 0.18);
      color: #111;
      overflow: hidden;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${PANEL_ID}.skim-page-panel-hidden { display: none; }
    #${PANEL_ID}.skim-page-panel-collapsed {
      gap: 8px;
      width: min(320px, calc(100vw - 36px));
      max-height: none;
    }
    #${PANEL_ID}.skim-page-panel-collapsed .skim-page-controls,
    #${PANEL_ID}.skim-page-panel-collapsed .skim-page-output,
    #${PANEL_ID}.skim-page-panel-collapsed .skim-page-followup,
    #${PANEL_ID}.skim-page-panel-collapsed .skim-page-panel-actions {
      display: none;
    }
    #${PANEL_ID}.skim-page-panel-dragging {
      user-select: none;
    }
    .skim-page-panel-header {
      display: flex;
      align-items: start;
      justify-content: space-between;
      gap: 12px;
      cursor: grab;
      touch-action: none;
    }
    #${PANEL_ID}.skim-page-panel-dragging .skim-page-panel-header {
      cursor: grabbing;
    }
    .skim-page-panel-header p {
      margin: 0 0 4px;
      color: #e8390e;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .skim-page-panel-header h2 {
      margin: 0;
      color: #111;
      font-size: 20px;
      line-height: 1.1;
    }
    .skim-page-icon-button {
      width: 32px;
      min-width: 32px;
      height: 32px;
      border: 1px solid #dedede;
      border-radius: 999px;
      background: #fff;
      color: #111;
      cursor: pointer;
    }
    .skim-page-window-actions {
      display: flex;
      gap: 7px;
    }
    .skim-page-window-actions button {
      flex: 0 0 auto;
    }
    .skim-page-status {
      margin: 0;
      color: #686868;
      font-size: 13px;
    }
    .skim-page-controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) max-content;
      gap: 12px;
      align-items: center;
      padding: 12px;
      border: 1px solid #ebebeb;
      border-radius: 8px;
      background: #fafafa;
    }
    .skim-page-control-group {
      display: grid;
      gap: 7px;
      min-width: 0;
    }
    .skim-page-control-label {
      color: #686868;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .skim-page-model-row {
      display: grid;
      grid-template-columns: minmax(132px, 0.72fr) minmax(128px, 1fr);
      gap: 8px;
      min-width: 0;
    }
    .skim-page-select-wrap {
      position: relative;
      display: block;
      min-width: 0;
    }
    .skim-page-select-wrap::after {
      content: "";
      position: absolute;
      top: 50%;
      right: 11px;
      width: 7px;
      height: 7px;
      border-right: 2px solid #5f5f5f;
      border-bottom: 2px solid #5f5f5f;
      pointer-events: none;
      transform: translateY(-70%) rotate(45deg);
    }
    .skim-page-custom-model-input,
    .skim-page-select-wrap select {
      box-sizing: border-box;
      min-height: 38px;
      width: 100%;
      min-width: 0;
      padding: 0 34px 0 12px;
      border: 1px solid #d8d8d8;
      border-radius: 7px;
      background: #fff;
      color: #111;
      font: inherit;
      font-size: 14px;
      font-weight: 650;
      line-height: 1;
      outline: none;
      transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }
    .skim-page-select-wrap select {
      appearance: none;
      cursor: pointer;
    }
    .skim-page-custom-model-input {
      padding-right: 12px;
    }
    .skim-page-custom-model-input:focus,
    .skim-page-select-wrap select:focus {
      border-color: #e8390e;
      box-shadow: 0 0 0 3px rgba(232, 57, 14, 0.14);
    }
    .skim-page-hidden {
      display: none;
    }
    .skim-page-web-search-field {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 38px;
      padding: 0 12px 0 10px;
      border: 1px solid #d8d8d8;
      border-radius: 999px;
      background: #fff;
      color: #222;
      cursor: pointer;
      user-select: none;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 750;
      transition: border-color 120ms ease, box-shadow 120ms ease, background 120ms ease;
    }
    .skim-page-web-search-field input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .skim-page-switch {
      position: relative;
      width: 32px;
      min-width: 32px;
      height: 18px;
      border-radius: 999px;
      background: #d7d7d7;
      transition: background 120ms ease;
    }
    .skim-page-switch::after {
      content: "";
      position: absolute;
      top: 3px;
      left: 3px;
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: #fff;
      box-shadow: 0 1px 3px rgba(17, 17, 17, 0.22);
      transition: transform 120ms ease;
    }
    .skim-page-web-search-field:has(input:checked) {
      border-color: rgba(232, 57, 14, 0.45);
      background: #fff6f3;
      color: #111;
    }
    .skim-page-web-search-field:has(input:checked) .skim-page-switch {
      background: #e8390e;
    }
    .skim-page-web-search-field:has(input:checked) .skim-page-switch::after {
      transform: translateX(14px);
    }
    .skim-page-web-search-field:has(input:focus-visible) {
      box-shadow: 0 0 0 3px rgba(232, 57, 14, 0.14);
    }
    @media (max-width: 460px) {
      .skim-page-controls {
        grid-template-columns: 1fr;
      }
      .skim-page-model-row {
        grid-template-columns: 1fr;
      }
      .skim-page-web-search-field {
        justify-content: space-between;
      }
    }
    .skim-page-output {
      display: grid;
      align-content: start;
      gap: 12px;
      overflow-x: hidden;
      overflow-y: auto;
      min-width: 0;
      min-height: 160px;
      max-height: 340px;
      padding: 12px;
      border: 1px solid #ebebeb;
      border-radius: 8px;
      background: #fafafa;
      color: #111;
      font-size: 14px;
      line-height: 1.55;
      white-space: pre-wrap;
    }
    .skim-page-message {
      display: grid;
      gap: 5px;
      min-width: 0;
      max-width: 100%;
      overflow: hidden;
    }
    .skim-page-message-label {
      margin: 0;
      color: #686868;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      line-height: 1.2;
      text-transform: uppercase;
    }
    .skim-page-message-body {
      width: fit-content;
      max-width: 100%;
      min-width: 0;
      box-sizing: border-box;
      padding: 10px 12px;
      border: 1px solid #e4e4e4;
      border-radius: 8px;
      background: #fff;
      color: #111;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      word-break: break-word;
      overflow-x: hidden;
    }
    .skim-page-message-body a {
      color: #d5320d;
      font-weight: 700;
      text-decoration: underline;
      text-decoration-thickness: 1px;
      text-underline-offset: 2px;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .skim-page-message-body a:hover {
      color: #a8260a;
    }
    .skim-page-message-user {
      justify-items: end;
    }
    .skim-page-message-user .skim-page-message-label {
      text-align: right;
    }
    .skim-page-message-user .skim-page-message-body {
      border-color: rgba(232, 57, 14, 0.25);
      background: #fff6f3;
    }
    .skim-page-message-assistant .skim-page-message-body {
      width: 100%;
    }
    .skim-page-message-notice .skim-page-message-label {
      color: #9a4b12;
    }
    .skim-page-message-notice .skim-page-message-body {
      width: 100%;
      border-color: rgba(232, 148, 14, 0.35);
      background: #fff9ed;
      color: #5e360a;
    }
    .skim-page-followup {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
    }
    .skim-page-followup input {
      min-height: 38px;
      padding: 0 10px;
      border: 1px solid #cfcfcf;
      border-radius: 6px;
      color: #111;
      font: inherit;
    }
    .skim-page-followup button,
    .skim-page-panel-actions button {
      min-height: 38px;
      padding: 0 12px;
      border: 0;
      border-radius: 6px;
      background: #111;
      color: #fff;
      cursor: pointer;
      font: inherit;
      font-weight: 700;
    }
    .skim-page-panel-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .skim-page-panel-actions button {
      border: 1px solid #cfcfcf;
      background: #fff;
      color: #111;
    }
  `;
  document.documentElement.append(style);
}

function isOpenPanelMessage(message: unknown): message is { type: string; sourceRequest: PanelSourceRequest } {
  return isMessageType(message, OPEN_PANEL_MESSAGE) && 'sourceRequest' in message;
}

function isStreamDeltaMessage(message: unknown): message is { type: string; delta: string } {
  return isMessageType(message, STREAM_DELTA_MESSAGE) && 'delta' in message;
}

function isStreamDoneMessage(message: unknown): message is { type: string } {
  return isMessageType(message, STREAM_DONE_MESSAGE);
}

function isErrorMessage(message: unknown): message is { type: string; error: string } {
  return isMessageType(message, ERROR_MESSAGE) && 'error' in message;
}

function isMessageType(message: unknown, type: string): message is { type: string } {
  return message !== null && typeof message === 'object' && 'type' in message && message.type === type;
}
