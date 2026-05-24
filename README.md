# skim.page Extension

This repo is the copied starting point for turning `skim.page` into a Chrome extension.

The original website app is preserved as a local playground, and shared prompt/provider logic now lives in a core package so the extension can reuse it.

## Structure

```text
apps/
  extension/       Chrome extension MVP workspace
  playground-web/  Existing Vite website/demo app
packages/
  core/            Shared prompts, provider helpers, and URL parsing
```

## Current Workspaces

- `@skim-page/extension`: extension app home, ready for Manifest V3 implementation
- `@skim-page/playground-web`: existing React playground for testing current skim.page behavior
- `@skim-page/core`: shared summary styles, prompt builders, provider aliases, handoff URL builders, and URL parsing

## Commands

Install dependencies:

```bash
npm install
```

Run the playground website:

```bash
npm run dev
```

Build the playground website:

```bash
npm run build
```

Preview the playground build:

```bash
npm run preview
```

## Extension Goals

- Choose a default AI assistant
- Add custom prompt styles
- Right-click selected text to summarize the selection
- Right-click a page to summarize the current URL
- Open the selected AI assistant with the generated prompt
- Store settings in Chrome storage
- Preserve copy fallback behavior when handoff prefill fails
