# skim.page Handoff

This file is for a fresh Codex instance with no conversation context. It captures the current state, decisions, test results, and next steps.

## Current Status

Workspace:

```text
/Users/praneethmini/Documents/codex_projects/skim-page
```

The app is a Vite + React + TypeScript MVP for `skim.page`. It is client-only and parses the browser URL to generate an AI prompt for an article URL.

What is implemented:

- Landing page in React with responsive hero plus provider/lens controls.
- Four lenses: Default, Investor, Research, ELI5.
- Five provider families: ChatGPT, Claude, Gemini, Grok, Perplexity.
- Provider aliases and full provider names in path/query URLs.
- Generated prompt fallback page.
- Malformed URL page.
- Copy prompt and open provider actions.
- Dynamic hero prefix and copy button.
- Fixed prompt preview height to avoid layout shift during auto-cycling.
- Google AI Mode search handoff for Gemini.

The in-app browser is currently on:

```text
http://127.0.0.1:5173/#how
```

A dev server has been used at:

```text
http://127.0.0.1:5173/
```

If the dev server is not running, start it with:

```bash
npm run dev -- --host 127.0.0.1
```

## Environment

No Python virtualenv, conda environment, Poetry environment, backend server, database, or seed process is used.

Do not create duplicate environments. This is a Node/npm app using the existing `node_modules` and `package-lock.json`.

Exact observed tool/package versions:

- Node: `v25.9.0`
- npm: `11.12.1`
- npm lockfile: version `3`
- React: `18.3.1`
- React DOM: `18.3.1`
- Vite: `6.4.2`
- TypeScript: `5.9.3`
- `@vitejs/plugin-react`: `4.7.0`
- `@types/react`: `18.3.28`
- `@types/react-dom`: `18.3.7`

`package.json` declares ranges; `package-lock.json` contains exact installed versions. Do not upgrade dependencies or change package managers unless the user asks.

## Commands

Install:

```bash
npm install
```

Dev:

```bash
npm run dev -- --host 127.0.0.1
```

Build:

```bash
npm run build
```

Preview:

```bash
npm run preview
```

Seeds:

- None.

## Important Paths

```text
README.md          Product/engineering overview and PRD
HANDOFF.md         This continuation file
skim.page.html     Original HTML skeleton and visual reference
index.html         Vite HTML entry
vite.config.ts     Vite config plus query URL fallback middleware
package.json       Scripts and package ranges
package-lock.json  Exact installed package versions
src/App.tsx        UI states and interactions
src/lenses.ts      Lens metadata and prompt templates
src/providers.ts   Provider aliases and handoff URL builders
src/url.ts         URL parsing and normalization
src/styles.css     App styling
dist/              Build output, generated
```

## Contracts

### Parsed Request Output

`parseLocation(location)` returns one of:

```ts
{ kind: 'landing' }
```

```ts
{
  kind: 'request';
  lensId: LensId;
  providerId: ProviderId;
  provider: Provider;
  articleUrl: string;
  prompt: string;
  handoffUrl: string;
  handoffMode: HandoffMode;
}
```

```ts
{ kind: 'malformed'; message: string; example: string }
```

### Lens IDs

```text
default
investor
research
eli5
```

### Lens Aliases

```text
default:  default, d
investor: investor, i
research: research, r
eli5:     eli5, e
```

### Provider IDs and Aliases

```text
chatgpt:    ch, chatgpt, openai
claude:     cl, claude
gemini:     ge, gemini
grok:       gr, grok
perplexity: px, perplexity
```

### URL Inputs

Supported paths:

```text
/https://example.com/article
/investor/https://example.com/article
/i/https://example.com/article
/research/https://example.com/article
/r/https://example.com/article
/eli5/https://example.com/article
/e/https://example.com/article
/cl/research/https://example.com/article
/cl/r/https://example.com/article
/claude/research/https://example.com/article
/px/https://example.com/article
/perplexity/investor/https://example.com/article
/ge/eli5/https://example.com/article
/ge/e/https://example.com/article
/grok/default/https://example.com/article
```

Supported query:

```text
/?url=https%3A%2F%2Fexample.com%2Farticle&lens=research&provider=cl
```

### Prompt Output

All prompts follow:

```text
{MODE_PROMPT}

Article URL: {ARTICLE_URL}
```

### Provider Handoff URLs

```text
ChatGPT:    https://chatgpt.com/?prompt={encodedPrompt}
Claude:     https://claude.ai/new?q={encodedPrompt}
Gemini:     https://www.google.com/search?udm=50&q={encodedPrompt}
Grok:       https://grok.com/?q={encodedPrompt}
Perplexity: https://www.perplexity.ai/?q={encodedPrompt}
```

Provider handoff is best-effort. Always keep copy fallback.

## Recent Test Results

Most recent build:

```text
> skim-page@0.1.0 build
> tsc -b && vite build

vite v6.4.2 building for production...
transforming...
30 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.90 kB | gzip:  0.49 kB
dist/assets/index-CaHfb61s.css    9.64 kB | gzip:  2.44 kB
dist/assets/index-CCcp4YDB.js   157.49 kB | gzip: 50.64 kB
built in 257ms
```

Browser checks performed:

- Landing page rendered locally at `http://127.0.0.1:5173/`.
- Labels verified: `Choose Your Provider`, `Choose your Lens`.
- Hero prefix copy button verified: one `Copy` button exists and changes to `Copied` after click.
- How It Works provider reference verified: includes `ch`, `cl`, `ge`, `gr`, `px` plus provider names.
- Gemini route tested at:

```text
http://127.0.0.1:5173/ge/https://example.com/article
```

Observed Gemini fallback:

```json
{
  "geminiOpenLinkCount": 1,
  "geminiHrefStartsAiMode": true,
  "geminiNotePresent": true
}
```

Generated Gemini href sample:

```text
https://www.google.com/search?udm=50&q=Summarize%20this%20article%20and%20provide...
```

Direct Google AI Mode URL test:

```json
{
  "directGoogleUrlStartsSearch": true,
  "hasUdm50": true,
  "hasQueryArticle": true,
  "pageMentionsAiMode": true
}
```

Known browser test caveat:

- The Codex in-app browser did not open target-blank external tabs during one test. Direct navigation to the generated URL verified the Google AI Mode URL itself.
- The in-app browser clipboard read API reported that its virtual clipboard was not installed. The UI click state was still verified by the button changing to `Copied`.

## Recent Decisions

- Multi-provider selection moved into Phase 1.
- Provider means provider family, not specific model.
- Support both short aliases and full provider names.
- Support single-letter lens aliases: `i`, `r`, and `e`.
- ChatGPT remains default provider.
- Gemini web handoff now uses Google AI Mode search via `udm=50`, not `gemini.google.com/app`.
- Gemini direct prompt injection is future browser extension work.
- Browser extension and custom lenses are Phase 2.
- No backend or direct API summarization in Phase 1.

## Open Challenges

- Provider handoff URLs are unofficial or best-effort. They can change without notice.
- Gemini via Google AI Mode depends on Google Search behavior and account/region eligibility.
- Popup blockers or browser surfaces may block automatic `window.open`.
- Production hosting must support SPA fallback routing for prepend-style paths.
- No automated test suite exists yet; verification is currently build plus browser checks.

## Next Steps

Likely next useful work:

1. Add lightweight unit tests for `src/url.ts`, `src/providers.ts`, and prompt generation.
2. Add deployment config for SPA fallback once hosting target is selected.
3. Browser-check mobile layout after any UI spacing changes.
4. Consider whether Gemini should still be labeled `Gemini` or `Google AI Mode` in the provider UI.
5. Keep README and HANDOFF updated after major decisions.

Phase 2 candidates:

- Chrome extension.
- Custom saved lenses.
- Extension storage for defaults.
- Gemini content-script prompt injection.
- Optional model selection where providers support stable model routing.

## Notes for Future Codex Instances

- Use `apply_patch` for manual file edits.
- Use `npm run build` after implementation changes.
- Prefer the existing modules and data-driven provider/lens pattern.
- Do not edit `dist/` manually.
- Do not add a backend, database, auth, article scraping, or API summarization unless the user explicitly changes scope.
- If testing in the in-app browser, the local URL is usually `http://127.0.0.1:5173/`.
