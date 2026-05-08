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
- Four lenses: Default, ELI5, Research, Investor.
- Five provider families: ChatGPT, Gemini, Claude, Perplexity, Grok.
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
public/favicon.svg Browser tab favicon using the s. brand mark
vite.config.ts     Vite config plus query URL fallback middleware
vercel.json        Vercel SPA fallback rewrite config
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
eli5
research
investor
```

### Lens Aliases

```text
default:  default, d
eli5:     eli5, e
research: research, r
investor: investor, i
```

### Provider IDs and Aliases

```text
chatgpt:    ch, chatgpt, openai
gemini:     ge, gemini
claude:     cl, claude
perplexity: px, perplexity
grok:       gr, grok
```

### URL Inputs

Supported paths:

```text
/https://example.com/article
/i/https://example.com/article
/r/https://example.com/article
/e/https://example.com/article
/cl/r/https://example.com/article
/px/https://example.com/article
/ge/e/https://example.com/article
/grok/default/https://example.com/article
```

Supported query:

```text
/?url=https%3A%2F%2Fexample.com%2Farticle&lens=research&provider=cl
```

### Prompt Output

All prompts are intentionally compact TL;DR prompts. They follow:

```text
{MODE_PROMPT}

Article URL: {ARTICLE_URL}
```

Current lens prompt shapes:

```text
Default: TLDR in 1-2 sentences, 3 key takeaways, why it matters in 1 sentence.
ELI5: TLDR, 3-5 simple bullets, one analogy, why it matters in 1 sentence.
Research: TLDR, main argument, 3 evidence/claim bullets, limitations, one open question.
Investor: TLDR, 2-bullet bull case, 2-bullet bear case, market implication, key metric/claim/risk.
```

### Provider Handoff URLs

```text
ChatGPT:    https://chatgpt.com/?prompt={encodedPrompt}
Gemini:     https://www.google.com/search?udm=50&q={encodedPrompt}
Claude:     https://claude.ai/new?q={encodedPrompt}
Perplexity: https://www.perplexity.ai/?q={encodedPrompt}
Grok:       https://grok.com/?q={encodedPrompt}
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
dist/index.html                   1.70 kB | gzip:  0.67 kB
dist/assets/index-BKuWQced.css    9.81 kB | gzip:  2.46 kB
dist/assets/index-BbKHv8Bj.js   158.37 kB | gzip: 50.66 kB
built in 258ms
```

Browser checks performed:

- Landing page rendered locally at `http://127.0.0.1:5173/`.
- Labels verified: `Choose Your Provider`, `Choose your Lens`.
- Hero prefix copy button verified: one `Copy` button exists and changes to `Copied` after click.
- How It Works provider reference verified: includes `ChatGPT (default)`, `ge`, `cl`, `px`, `gr` plus provider names.
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
- Hero eyebrow text follows the selected lens: smarter, better, deeper, faster.
- ChatGPT is included in provider UI as the default; `ch` remains supported as a hidden URL alias.
- Provider order is ChatGPT, Gemini, Claude, Perplexity, Grok.
- Lens order is Default, ELI5, Research, Investor.
- Hero prefix uses short lens aliases, and provider/lens buttons show shortcuts in parentheses.
- How It Works shows the note `Use the shortcut or full name.` above the shortcut badges.
- Default is not shown as a lens shortcut chip; the absence of a lens means Default.
- Lens prompts were shortened so first outputs stay TL;DR-sized; users can ask the AI for deeper follow-up in chat.
- Public deploy prep added `vercel.json` for Vercel SPA fallback, favicon, and share metadata in `index.html`.
- ChatGPT remains default provider.
- Gemini web handoff now uses Google AI Mode search via `udm=50`, not `gemini.google.com/app`.
- Gemini direct prompt injection is future browser extension work.
- Browser extension and custom lenses are Phase 2.
- No backend or direct API summarization in Phase 1.

## Open Challenges

- Provider handoff URLs are unofficial or best-effort. They can change without notice.
- Gemini via Google AI Mode depends on Google Search behavior and account/region eligibility.
- Popup blockers or browser surfaces may block automatic `window.open`.
- Production hosting must support SPA fallback routing for prepend-style paths. Vercel is covered by `vercel.json`; other hosts need equivalent rewrites.
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
