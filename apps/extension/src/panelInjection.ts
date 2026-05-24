import type { PromptStyleId } from '@skim-page/core';

export type PanelSourceRequest =
  | { kind: 'page'; model?: string; styleId?: PromptStyleId; webSearchEnabled?: boolean }
  | {
      kind: 'selection';
      model?: string;
      mode?: 'prompt-first' | 'summarize';
      styleId?: PromptStyleId;
      text: string;
      url: string;
      title?: string;
      webSearchEnabled?: boolean;
    };

const OPEN_PANEL_MESSAGE = 'skim-page:open-panel';

export async function injectPanel(tabId: number, sourceRequest: PanelSourceRequest): Promise<void> {
  const [injectionCheck] = await chrome.scripting.executeScript({
    func: () => Boolean((globalThis as { __SKIM_PAGE_PANEL_READY__?: boolean }).__SKIM_PAGE_PANEL_READY__),
    target: { tabId },
  });

  if (!injectionCheck?.result) {
    await chrome.scripting.executeScript({
      files: ['contentScript.js'],
      target: { tabId },
    });
  }

  await chrome.tabs.sendMessage(tabId, { type: OPEN_PANEL_MESSAGE, sourceRequest });
}
