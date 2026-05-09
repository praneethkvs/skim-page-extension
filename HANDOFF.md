# skim.page Handoff

This file is for a fresh Codex instance with no prior conversation context. It captures the current project state, decisions, contracts, tests, and next steps.

## Current Status

Workspace:

```text
/Users/praneethmini/Documents/codex_projects/skim-page
```

The app is a client-only Vite + React + TypeScript MVP for `skim.page`, a bookmarkable URL shortcut for AI summaries.

Current product behavior:

- User prepends `skim.page/` to an article URL.
- Optional summary style and AI app shortcuts may be added before the article URL.
- Preferred path order is summary style first, then AI app: `skim.page/i/cl/...`.
- App builds a prompt from the selected summary style and article URL.
- App redirects the current tab to the selected AI app with `window.location.replace(handoffUrl)`.
- Copyable fallback page remains available for copy-only or interrupted handoffs.

Implemented UI/product work:

- Landing page with centered hero and demo below.
- Demo is the first meaningful product surface, not just decorative typography.
- URL field includes a dynamic colored `skim.page/.../` prefix.
- Real article URLs are prefilled by summary style.
- Dropdowns are custom styled, Summary style first and AI app second.
- Summary style options: Summary, ELI5, Research, Investor.
- AI app options: ChatGPT, Gemini, Claude, Perplexity, Grok.
- Prompt preview is collapsed by default and expands to a compact fixed height.
- Privacy page, FAQ, source link, feedback link, changelog link, and footer cleanup are in place.
- Known limitations are in FAQ, not a separate limitations panel.
- Same-tab handoff replaced old new-tab/popup behavior.

Current local browser context reported by the user has often been:

```text
http://127.0.0.1:5174/
```

Use `5173` first when starting Vite; if occupied, Vite commonly uses `5174`.

Production:

```text
https://skim-page.vercel.app
```

Last recorded verified deployment before the latest local edits:

```text
Deployment ID: dpl_HFLEnCv9u6AbwQRgCpejrGj76n8D
Deployment URL: https://skim-page-osauczj5p-praneethjm-1141s-projects.vercel.app
Commit: 51dc32a Promote popup permission alert
Status: READY
```

Note: that deployment label is historical. Local code has since changed from popup/new-tab handoff to same-tab redirect.

## Environment

No Python virtualenv, conda environment, Poetry environment, backend server, database, or seed process is used.

Do not create duplicate environments. This is a Node/npm app using the existing `package-lock.json`.

Exact observed versions:

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

Important package note:

- `package.json` contains semver ranges.
- `package-lock.json` contains exact installed versions.
- Do not upgrade packages, switch package managers, add a backend, or introduce new environment tooling unless the user explicitly asks.

## Commands

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev -- --host 127.0.0.1
```

Build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Seeds:

- None.

Testing pattern used in this thread:

- Run `npm run build` after implementation changes.
- For browser verification, start Vite with `npm run dev -- --host 127.0.0.1`.
- If Vite starts on `5174`, use `http://127.0.0.1:5174/`.
- Stop temporary dev servers after verification if you started them.

## Important Paths And Artifacts

```text
README.md          Holistic product/engineering overview
HANDOFF.md         This continuation file
skim.page.html     Original static HTML visual reference; current app is in src/
index.html         Vite entry HTML and metadata
public/favicon.svg Browser tab favicon using the s. mark
vite.config.ts     React plugin plus dev query URL fallback middleware
vercel.json        Production SPA fallback rewrite config
.vercel/           Local Vercel project link; ignored by git
package.json       Scripts and package ranges
package-lock.json  Exact installed package versions
src/App.tsx        UI states, landing, fallback, privacy, interactions
src/lenses.ts      Summary style metadata, aliases, prompt templates
src/providers.ts   AI app aliases and handoff URL builders
src/url.ts         URL parsing, normalization, request construction
src/styles.css     App styling and responsive behavior
dist/              Build output, generated; do not hand-edit
```

No datasets are used. The closest thing to seeded content is the built-in style-matched demo URLs in `src/App.tsx`.

Current demo URLs:

```text
Summary:  https://blog.google/innovation-and-ai/technology/ai/google-gemini-ai/
ELI5:     https://science.nasa.gov/earth/climate-change/nope-earth-isnt-cooling/
Research: https://science.nasa.gov/climate-change/evidence/
Investor: https://www.apple.com/newsroom/2026/01/apple-reports-first-quarter-results/
```

## Contracts

### Parsed Request Output

`parseLocation(location)` returns:

```ts
{ kind: 'landing' }
```

or:

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

or:

```ts
{ kind: 'malformed'; message: string; example: string }
```

### Summary Style IDs And Aliases

```text
default:  default, d     -> displayed as Summary
eli5:     eli5, e        -> displayed as ELI5
research: research, r    -> displayed as Research
investor: investor, i    -> displayed as Investor
```

Internal id `default` must remain stable even though the display label is now `Summary`.

### AI App IDs And Aliases

```text
chatgpt:    ch, chatgpt, openai
gemini:     ge, gemini
claude:     cl, claude
perplexity: px, perplexity
grok:       gr, grok
```

### URL Inputs

Preferred summary-style-first paths:

```text
/https://example.com/article
/i/https://example.com/article
/r/https://example.com/article
/e/https://example.com/article
/r/cl/https://example.com/article
/e/ge/https://example.com/article
/default/grok/https://example.com/article
```

Legacy AI-app-first paths still parse:

```text
/cl/r/https://example.com/article
```

Supported query format:

```text
/?url=https%3A%2F%2Fexample.com%2Farticle&lens=research&provider=cl
```

Normalization expectations:

- `https://example.com/article` stays `https://example.com/article`.
- `https:/example.com/article` normalizes to `https://example.com/article`.
- `example.com/article` normalizes to `https://example.com/article`.
- Missing/unknown summary style falls back to Summary.
- Missing/unknown AI app falls back to ChatGPT.

### Prompt Output

All prompts follow:

```text
{STYLE_PROMPT}

Article URL: {ARTICLE_URL}
```

Style shapes:

```text
Summary: TLDR in 1-2 sentences, 3 key takeaways, why it matters in 1 sentence.
ELI5: TLDR, 3-5 simple bullets, one analogy, why it matters in 1 sentence.
Research: TLDR, main argument, 3 evidence/claim bullets, limitations, one open question.
Investor: TLDR, 2-bullet bull case, 2-bullet bear case, market implication, key metric/claim/risk.
```

### AI App Handoff URLs

```text
ChatGPT:    https://chatgpt.com/?prompt={encodedPrompt}
Gemini:     https://www.google.com/search?udm=50&q={encodedPrompt}
Claude:     https://claude.ai/new?q={encodedPrompt}
Perplexity: https://www.perplexity.ai/?q={encodedPrompt}
Grok:       https://grok.com/?q={encodedPrompt}
```

Handoff behavior:

- `PromptFallback` redirects with `window.location.replace(request.handoffUrl)` for normal handoff modes.
- The fallback page remains useful if handoff is interrupted or a provider mode becomes copy-only.
- Manual `Open {provider}` action uses same-tab navigation, not `target="_blank"`.
- Do not reintroduce `window.open` unless the user explicitly changes the CX decision.

### Expected Generated Prompt Page

The generated prompt page is usually visible only briefly before same-tab redirect, but should still work as fallback:

```text
Top fallback alert with circular !
Generated prompt label
Summary style title and description
AI app label and provider name
Provider-specific note
Normalized article URL
Generated prompt block
Open {Provider}
Copy prompt
```

Fallback alert copy should communicate that the prompt is ready and can be copied if the AI app does not receive it. It should not mention pop-up permissions.

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
dist/index.html                   1.73 kB | gzip:  0.64 kB
dist/assets/index-ClnTXDpO.css   18.40 kB | gzip:  4.11 kB
dist/assets/index-j9M0YhY6.js   165.22 kB | gzip: 52.84 kB
built in 254ms
```

Browser checks performed recently:

- Landing page rendered locally at `http://127.0.0.1:5174/`.
- Dropdown labels verified in order: `Summary style`, then `AI app`.
- Prefix verified as `skim.page/i/cl/` for Investor + Claude.
- `/i/cl/https://example.com/article` parsed as Investor + Claude.
- `/cl/i/https://example.com/article` still parsed as Investor + Claude.
- Same-tab handoff test:
  - Started from `https://example.com/article`.
  - Navigated to `http://127.0.0.1:5174/i/cl/https://example.com/article`.
  - Tab redirected to `https://claude.ai/new...`.
  - Browser Back returned to `https://example.com/article`.
  - No extra AI app tab was created.
- Earlier Gemini handoff verification showed generated URL starts with `https://www.google.com/search?udm=50&q=`.

Known testing caveat:

- The in-app browser clipboard read API previously reported that its virtual clipboard was not installed. The UI click state was still verified by the button changing to `Copied`.

## Recent Decisions

- Summary style is primary; AI app is secondary.
- Prefix/path order is summary style first, then AI app.
- Legacy AI-app-first URLs remain supported.
- Default summary style display name is `Summary`; internal id remains `default`.
- Demo input uses real public article URLs, matched to the active summary style.
- User-edited article URLs are not overwritten by style changes.
- Generated prompt preview is collapsed by default.
- Expanded prompt preview was shortened by roughly two lines.
- Native select controls were replaced with custom dropdowns; option rows are styled like selected rows.
- Same-tab redirect replaced the previous new-tab/popup approach.
- `window.location.replace` is intentional so Back returns to the article rather than stopping on skim.page.
- Gemini web handoff uses Google AI Mode search (`udm=50`), not direct Gemini prompt injection.
- Privacy/FAQ/source/feedback/changelog trust builders are part of the landing page.
- Footer no longer includes maker/free/version text; maker identity is in FAQ.
- Known limitations moved into FAQ.

## Open Challenges

- Provider URL prefill behavior is unofficial and can change.
- ChatGPT, Claude, Perplexity, Grok, and Google may require login or may ignore/query-handle prompts differently over time.
- Gemini via Google AI Mode depends on Google Search behavior, account state, region, and rollout.
- No automated test suite exists yet; verification is currently build plus browser checks.
- Production has not necessarily been redeployed after the latest local UI/handoff edits.
- The original `skim.page.html` is stale relative to the React app and should be treated as visual reference only.
- Some CSS class names still include `popup-alert` for historical styling, but current copy/behavior is fallback alert, not popup permission.

## Next Steps

Likely useful next work:

1. Add lightweight unit tests for `src/url.ts`, `src/providers.ts`, and `src/lenses.ts`.
2. Add browser-level tests for the same-tab handoff behavior and Back-button expectation.
3. Browser-check mobile layout after any demo/card/dropdown spacing edits.
4. Decide whether Gemini should be labeled `Gemini` or `Google AI Mode`.
5. Decide whether to deploy latest local edits to Vercel.
6. Consider renaming historical CSS classes from `popup-alert` to `fallback-alert` in a low-risk cleanup.
7. Keep README and HANDOFF updated after any major UX or contract decision.

Phase 2 candidates:

- Chrome/browser extension.
- Custom saved summary styles.
- Extension storage for defaults.
- Gemini content-script prompt injection.
- Optional model selection where providers support stable model routing.

## Notes For Future Codex Instances

- Use `apply_patch` for manual file edits.
- Use `rg` for searching.
- Run `npm run build` after implementation changes.
- Prefer existing modules and data-driven summary style / AI app patterns.
- Do not hand-edit `dist/`.
- Do not create virtualenvs, conda envs, Poetry projects, databases, backends, auth, scraping, analytics, or direct API summarization unless the user explicitly changes scope.
- Do not upgrade packages or switch to pnpm/yarn unless asked.
- Be careful with git: there may be unrelated user edits. Do not revert changes you did not make.
- If you start a temporary Vite server, stop the `5174`/chosen-port processes when done unless the user asks to keep it running.
