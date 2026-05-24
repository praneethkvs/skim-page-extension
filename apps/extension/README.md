# skim.page Extension

Manifest V3 Chrome extension for skim.page. It supports provider handoff prompts and optional BYOK in-page AI summaries.

## Build

From the repo root:

```bash
npm run build:extension
```

Run prompt tests, storage checks, extension build, and package smoke checks:

```bash
npm run test
```

Load the unpacked extension from:

```text
apps/extension/dist
```

After rebuilding, reload the extension in `chrome://extensions` and refresh any article tabs before retesting. Chrome keeps old injected content scripts alive until the page refreshes.

## Current Scope

- Manifest V3 extension with background service worker, popup, options page, context menus, and dynamic content-script injection.
- Provider handoff remains available without an OpenAI key.
- Optional BYOK in-page summaries use the OpenAI Responses API directly from the background service worker.
- OpenAI API key is stored only in `chrome.storage.local`.
- Non-secret settings are stored in `chrome.storage.sync`.
- Settings include default summary style, provider, in-page summaries toggle, default model, and default web-search toggle.
- Default in-page model is `gpt-5.4-mini`.
- Options and in-page panel expose preset model choices plus a custom model field.
- Context menus support selection and page flows.
- In-page flow supports selected text, visible page text, and URL fallback.
- Selection prompts include the source page URL for context.
- In-page panel supports streaming responses, follow-up questions, copying the thread, regenerating, provider fallback, close, collapse/expand, and drag-to-move.
- Follow-ups stay in the same in-memory conversation thread; transcripts are not persisted.
- Timeout/error notices are rendered as notices, not assistant messages, and are not sent back as conversation history.
- After a failed follow-up, `Regenerate` retries the failed prompt with the currently selected model/web-search settings.
- Web search is optional and sends `tools: [{ type: "web_search" }]` only when enabled.
- In-page response rendering safely converts markdown links and bare URLs into clickable links without using raw `innerHTML`.
- Custom prompt styles can be created, edited, deleted, used as defaults, and selected from context menus.
- Custom styles are listed before built-in styles.
- Built-in provider handoff still uses shared prompt/provider logic from `packages/core`.
- Extension assets include skim.page branded icons and bundled website OG assets.

Reader-mode extraction, persisted transcript history, account sync for API keys, and deep article fetching are intentionally deferred.

## Manual Test

1. Build with `npm run build:extension`.
2. Open `chrome://extensions`, enable Developer mode, and load unpacked from `apps/extension/dist`.
3. After each rebuild, click Reload on the extension and refresh article tabs.
4. Open Options and save default summary style/provider.
5. Add an OpenAI API key, test it, enable in-page summaries, choose a model, and optionally enable web search by default.
6. Add a custom style and confirm the existing default does not change unless explicitly saved.
7. Confirm context menus update after custom style changes.
8. Right-click selected text and test:
   - `Summarize in page` -> `Use my defaults`
   - custom style entries
   - built-in style entries
   - `Open with selected text`
   - `Open in AI assistant`
9. Right-click a page and test in-page and provider handoff flows.
10. In the panel, test model switching, web-search toggle, streaming output, clickable links, follow-up thread behavior, copy, regenerate, close, collapse/expand, and dragging.
11. Force a slow/failing request, then change model or web-search and use `Regenerate` to retry.
12. Remove the OpenAI key and confirm in-page options fall back to setup/provider handoff behavior.

## Notes

- In-page OpenAI calls are made from the background service worker so content scripts never receive the API key.
- Page summarization uses visible text from `article`, `main`, or `body`, capped conservatively.
- If visible text is too short, the panel uses URL fallback and tells the assistant to work from the URL.
- Prompt guardrails tell the model to treat page content as source data, not instructions.
- Web search can increase latency and cost; source-only summaries should stay the default for most users.
