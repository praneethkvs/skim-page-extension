import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { buildPreviewPrompt, lensIds, lenses, type LensId } from './lenses';
import {
  DEFAULT_PROVIDER_ID,
  providerIds,
  providers,
  type ProviderId,
} from './providers';
import { parseLocation, type ParsedLocation } from './url';

const SOURCE_URL = 'https://github.com/praneethkvs/skim.page';
const FEEDBACK_URL = 'https://github.com/praneethkvs/skim.page/issues';

const exampleArticleUrls: Record<LensId, string> = {
  default: 'https://blog.google/innovation-and-ai/technology/ai/google-gemini-ai/',
  eli5: 'https://science.nasa.gov/earth/climate-change/nope-earth-isnt-cooling/',
  research: 'https://science.nasa.gov/climate-change/evidence/',
  investor: 'https://www.apple.com/newsroom/2026/01/apple-reports-first-quarter-results/',
};

function App() {
  const parsedLocation = useMemo(() => parseLocation(window.location), []);
  const isPrivacyPage = isStaticPage(window.location, 'privacy');
  const initialLensId = parsedLocation.kind === 'request' ? parsedLocation.lensId : 'default';
  const initialProviderId =
    parsedLocation.kind === 'request' ? parsedLocation.providerId : DEFAULT_PROVIDER_ID;
  const [activeLensId, setActiveLensId] = useState<LensId>(initialLensId);
  const [activeProviderId, setActiveProviderId] = useState<ProviderId>(initialProviderId);
  const activeLens = lenses[activeLensId];

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', activeLens.color);
    document.documentElement.style.setProperty('--accent-dim', hexToRgba(activeLens.color, 0.08));
  }, [activeLens.color]);

  return (
    <>
      <Nav />
      {isPrivacyPage ? (
        <PrivacyPage />
      ) : parsedLocation.kind === 'request' ? (
        <PromptFallback request={parsedLocation} />
      ) : parsedLocation.kind === 'malformed' ? (
        <MalformedState parsed={parsedLocation} />
      ) : (
        <LandingPage
          activeLensId={activeLensId}
          activeProviderId={activeProviderId}
          onLensChange={setActiveLensId}
          onProviderChange={setActiveProviderId}
        />
      )}
      <Footer />
    </>
  );
}

function Nav() {
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    function updateScrollState() {
      setHasScrolled(window.scrollY > 8);
    }

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });

    return () => window.removeEventListener('scroll', updateScrollState);
  }, []);

  return (
    <nav className={hasScrolled ? 'nav-scrolled' : undefined}>
      <a href="/" className="nav-logo">
        skim<span className="dot">.</span>page
      </a>
      <div className="nav-right">
        <a href="/#how" className="nav-link">
          How it works
        </a>
        <a href="/#faq" className="nav-link">
          FAQ
        </a>
        <a href="/privacy" className="nav-link">
          Privacy
        </a>
      </div>
    </nav>
  );
}

type LandingPageProps = {
  activeLensId: LensId;
  activeProviderId: ProviderId;
  onLensChange: (lensId: LensId) => void;
  onProviderChange: (providerId: ProviderId) => void;
};

function LandingPage({
  activeLensId,
  activeProviderId,
  onLensChange,
  onProviderChange,
}: LandingPageProps) {
  const activeLens = lenses[activeLensId];
  const activeProvider = providers[activeProviderId];
  const [isAutoCycling, setIsAutoCycling] = useState(true);
  const [isUsingExampleUrl, setIsUsingExampleUrl] = useState(true);
  const [articleUrl, setArticleUrl] = useState(exampleArticleUrls[activeLensId]);
  const skimPrefix = buildSkimPrefix(activeLensId, activeProviderId);
  const summaryPromptUrl = buildSummaryPromptUrl(articleUrl, activeProviderId, activeLensId);
  const hasArticleUrl = articleUrl.trim().length > 0;

  useEffect(() => {
    if (!isAutoCycling) {
      return;
    }

    const timer = window.setInterval(() => {
      onLensChange(lenses[getNextLensId(activeLensId)].id);
    }, 3600);

    return () => window.clearInterval(timer);
  }, [activeLensId, isAutoCycling, onLensChange]);

  useEffect(() => {
    if (isUsingExampleUrl) {
      setArticleUrl(exampleArticleUrls[activeLensId]);
    }
  }, [activeLensId, isUsingExampleUrl]);

  function chooseLens(lensId: LensId) {
    setIsAutoCycling(false);
    onLensChange(lensId);
  }

  function chooseProvider(providerId: ProviderId) {
    setIsAutoCycling(false);
    onProviderChange(providerId);
  }

  function openSummaryPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!hasArticleUrl) {
      return;
    }

    window.location.href = summaryPromptUrl;
  }

  return (
    <>
      <div className="landing-grid">
        <section className="hero">
          <div className="hero-eyebrow" id="hero-eyebrow">
            {activeLens.eyebrow}
          </div>
          <h1 className="hero-headline">
            Summarize articles
            <br />
            <em id="hero-em">with your AI app.</em>
          </h1>
          <p className="hero-sub">
            Just add <code>skim.page/</code> in front of any article URL in your browser, and get
            the TL;DR.
          </p>
          <p className="hero-built-for">
            Use with your preferred chatbot
          </p>
        </section>

        <section
          className="demo-section"
          id="lenses"
          onMouseEnter={() => setIsAutoCycling(false)}
        >
          <form className="summary-demo" onSubmit={openSummaryPrompt}>
            <label className="url-field">
              <div className="url-input-row">
                <span className="url-prefix">{skimPrefix}</span>
                <input
                  onChange={(event) => {
                    setIsUsingExampleUrl(false);
                    setArticleUrl(event.target.value);
                  }}
                  placeholder={exampleArticleUrls[activeLensId]}
                  type="text"
                  value={articleUrl}
                />
                <button
                  className="action-button action-primary summary-submit"
                  disabled={!hasArticleUrl}
                  type="submit"
                >
                  Try it
                </button>
              </div>
            </label>
            <div className="demo-controls">
              <div className="style-control">
                <Dropdown
                  label="Summary style"
                  onChange={chooseLens}
                  options={lensIds.map((lensId) => ({
                    label: formatLensTabLabel(lenses[lensId]),
                    value: lensId,
                  }))}
                  value={activeLensId}
                />
              </div>
              <div className="provider-control">
                <Dropdown
                  label="AI app"
                  onChange={chooseProvider}
                  options={providerIds.map((providerId) => ({
                    label: formatProviderTabLabel(providerId),
                    value: providerId,
                  }))}
                  value={activeProviderId}
                />
              </div>
            </div>
            <div className="lens-meta">
              <div className="lens-title" id="lens-title">
                {activeLens.title}
              </div>
              <div className="lens-desc" id="lens-desc">
                {activeLens.desc}
              </div>
              <p className="lens-plain-desc">{summaryStyleDescriptions[activeLensId]}</p>
            </div>
            <details className="preview-shell">
              <summary className="preview-header">
                <span>Generated prompt preview</span>
                <strong>{activeProvider.label}</strong>
              </summary>
              <div className="prompt-block prompt-preview" id="prompt-block">
                {buildPreviewPrompt(activeLens)}
              </div>
            </details>
          </form>
        </section>
      </div>

      <section className="how-section" id="how">
        <div className="how-inner">
          <p className="section-label">How it works</p>
          <div className="how-steps">
            <div className="how-step">
              <div className="step-num accent-color">1</div>
              <div className="step-title">Find any article</div>
              <div className="step-body">
                Open any news article, blog post, or long-read in your browser.
              </div>
            </div>
            <div className="how-step">
              <div className="step-num accent-color">2</div>
              <div className="step-title">Prepend the URL</div>
              <div className="step-body">
                Add <code>skim.page/</code> before the article URL. For example,
                <br />
                <code>skim.page/https://example.com/article</code>.
              </div>
            </div>
            <div className="how-step">
              <div className="step-num accent-color">3</div>
              <div className="step-title">Open your AI app</div>
              <div className="step-body">
                Your current tab redirects with a ready prompt. If the AI app does not pick it up,
                copy the prompt from skim.page.
              </div>
            </div>
          </div>
          <div className="shortcut-reference" aria-label="URL shortcuts">
            <div className="shortcut-heading">
              <p className="section-label">URL shortcuts</p>
              <h3>Power-user paths</h3>
            </div>
            <div className="shortcut-example">
              <code>skim.page/i/cl/https://example.com/article</code>
              <span>uses the Investor summary style in Claude.</span>
            </div>
            <p className="shortcut-note">
              Add a summary style shortcut, an AI app shortcut, or both before the article URL.
              Full names work too, like <code>skim.page/investor/claude/...</code>.
            </p>
            <div className="shortcut-group">
              <div className="shortcut-title">Summary styles</div>
              <div className="shortcut-badges">
                <span>Summary (default)</span>
                <span><strong>e</strong> ELI5</span>
                <span><strong>r</strong> Research</span>
                <span><strong>i</strong> Investor</span>
              </div>
            </div>
            <div className="shortcut-group">
              <div className="shortcut-title">AI apps</div>
              <div className="shortcut-badges">
                <span>ChatGPT (default)</span>
                <span><strong>ge</strong> Gemini</span>
                <span><strong>cl</strong> Claude</span>
                <span><strong>px</strong> Perplexity</span>
                <span><strong>gr</strong> Grok</span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <TrustSection />
    </>
  );
}

function TrustSection() {
  return (
    <section className="trust-section" id="faq">
      <div className="trust-inner">
        <div className="trust-heading">
          <p className="section-label">FAQ</p>
          <h2>Small print, plainly said.</h2>
        </div>
        <div className="faq-list">
          {faqItems.map((item, index) => (
            <details className="faq-item" key={item.question} open={index === 0}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

const faqItems = [
  {
    question: 'What data does skim.page see?',
    answer:
      'skim.page sees the article URL you put in the address bar so it can build the prompt. The app runs in your browser and does not scrape the article, create accounts, or store prompts. Hosting infrastructure, your browser history, and the AI app you open may still receive the article URL or generated prompt.',
  },
  {
    question: 'Does this bypass paywalls?',
    answer:
      'No. skim.page does not unlock paid content, fetch article text, or work around publisher access rules. It only hands the article URL to an AI app you already choose to use.',
  },
  {
    question: 'Does this summarize the article itself?',
    answer:
      'No. skim.page generates a prompt and opens your selected AI app. That AI app handles any summarization, subject to its own access, login, and URL-reading behavior.',
  },
  {
    question: 'Will skim.page stay free?',
    answer:
      'skim.page is just a static URL shortcut. There is no backend summarizer, no account system, and no model bill for skim.page to pay, so the running costs stay tiny.',
  },
    {
      question: 'What can stop the handoff from opening?',
      answer:
      'You may need to be logged in to the AI app you choose, and provider URL behavior can vary. The copyable prompt stays on skim.page as a fallback.',
    },
  {
    question: 'Who makes skim.page?',
    answer:
      'skim.page is an evolving small project by Praneeth. The source is public on GitHub, and feedback is welcome through GitHub issues.',
  },
];

const summaryStyleDescriptions: Record<LensId, string> = {
  default: 'A quick TL;DR, three takeaways, and why it matters.',
  eli5: 'Plain-language bullets and an analogy for fast understanding.',
  research: 'Main argument, evidence, assumptions, and one open question.',
  investor: 'Bull case, bear case, market implication, and key risk.',
};

type DropdownOption<T extends string> = {
  label: string;
  value: T;
};

type DropdownProps<T extends string> = {
  label: string;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  value: T;
};

function Dropdown<T extends string>({ label, onChange, options, value }: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        dropdownRef.current &&
        event.target instanceof Node &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div className="select-field" ref={dropdownRef}>
      <span className="section-label">{label}</span>
      <div className={isOpen ? 'custom-select custom-select-open' : 'custom-select'}>
        <button
          aria-expanded={isOpen}
          className="custom-select-trigger"
          onClick={() => setIsOpen((current) => !current)}
          type="button"
        >
          {selectedOption.label}
        </button>
        {isOpen ? (
          <div className="custom-select-menu" role="listbox">
            {options.map((option) => (
              <button
                aria-selected={option.value === value}
                className="custom-select-option"
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                role="option"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function buildSkimPrefix(lensId: LensId, providerId: ProviderId): string {
  const lensPrefix = lenses[lensId].demoSuffix;
  const providerSuffix = providerId === DEFAULT_PROVIDER_ID ? '' : `/${providers[providerId].shortAlias}`;

  return `skim.page${lensPrefix}${providerSuffix}/`;
}

function getNextLensId(currentLensId: LensId): LensId {
  const currentIndex = lensIds.indexOf(currentLensId);
  const nextIndex = (currentIndex + 1) % lensIds.length;

  return lensIds[nextIndex];
}

function buildSummaryPromptUrl(
  articleUrl: string,
  providerId: ProviderId,
  lensId: LensId,
): string {
  const params = new URLSearchParams({
    url: articleUrl.trim(),
    provider: providerId,
    lens: lensId,
  });

  return `/?${params.toString()}`;
}

function formatLensTabLabel(lens: (typeof lenses)[LensId]): string {
  if (!lens.shortAlias) {
    return lens.title;
  }

  return `${lens.title} (${lens.shortAlias})`;
}

function formatProviderTabLabel(providerId: ProviderId): string {
  const provider = providers[providerId];

  if (providerId === DEFAULT_PROVIDER_ID) {
    return `${provider.label} (Default)`;
  }

  return `${provider.label} (${provider.shortAlias})`;
}

type PromptFallbackProps = {
  request: Extract<ParsedLocation, { kind: 'request' }>;
};

function PromptFallback({ request }: PromptFallbackProps) {
  const [copyLabel, setCopyLabel] = useState('Copy prompt');
  const promptRef = useRef<HTMLDivElement>(null);
  const didAutoOpen = useRef(false);
  const lens = lenses[request.lensId];
  const provider = providers[request.providerId];
  const isPromptCopied = copyLabel === 'Copied';

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', lens.color);
    document.documentElement.style.setProperty('--accent-dim', hexToRgba(lens.color, 0.08));
  }, [lens.color]);

  useEffect(() => {
    if (request.handoffMode === 'copyOnly' || didAutoOpen.current) {
      return;
    }

    didAutoOpen.current = true;

    window.location.replace(request.handoffUrl);
  }, [request.handoffMode, request.handoffUrl]);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(request.prompt);
      setCopyLabel('Copied');
      window.setTimeout(() => setCopyLabel('Copy prompt'), 1600);
    } catch {
      if (fallbackCopyText(request.prompt)) {
        setCopyLabel('Copied');
        window.setTimeout(() => setCopyLabel('Copy prompt'), 1600);
        return;
      }

      const selection = window.getSelection();
      const range = document.createRange();

      if (promptRef.current && selection) {
        range.selectNodeContents(promptRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  return (
    <main className="result-page">
      <section className="result-section">
        <div className="popup-alert popup-alert-top" role="status">
          <span className="popup-alert-mark" aria-hidden="true">
            !
          </span>
          <div>
            <strong>Prompt ready.</strong>
            <span>
              If {provider.label} does not open with the prompt, copy it here and paste it into
              your AI app.
            </span>
          </div>
        </div>
        <p className="section-label">Generated prompt</p>
        <div className="lens-meta">
          <div className="lens-title">{lens.title}</div>
          <div className="lens-desc">{lens.desc}</div>
        </div>
        <div className="result-provider">
          <span>AI app</span>
          <strong>{provider.label}</strong>
        </div>
        <p className="provider-note">{provider.note}</p>
        <p className="result-url">{request.articleUrl}</p>
        <div className="prompt-block result-prompt" ref={promptRef}>
          {request.prompt}
        </div>
        <div className="result-actions">
          <a
            className="action-button action-primary"
            href={request.handoffUrl}
          >
            Open {provider.label}
          </a>
          <button
            className={isPromptCopied ? 'action-button copy-success' : 'action-button'}
            onClick={copyPrompt}
            type="button"
          >
            {isPromptCopied ? 'Copied' : copyLabel}
          </button>
        </div>
      </section>
    </main>
  );
}

type MalformedStateProps = {
  parsed: Extract<ParsedLocation, { kind: 'malformed' }>;
};

function MalformedState({ parsed }: MalformedStateProps) {
  return (
    <main className="result-page">
      <section className="result-section">
        <p className="section-label">URL not detected</p>
        <h1 className="hero-headline malformed-headline">
          Try that
          <br />
          <em>one more time.</em>
        </h1>
        <p className="hero-sub malformed-copy">{parsed.message}</p>
        <div className="prompt-block">{parsed.example}</div>
        <div className="result-actions">
          <a className="action-button action-primary" href="/">
            Back home
          </a>
        </div>
      </section>
    </main>
  );
}

function PrivacyPage() {
  return (
    <main className="static-page">
      <section className="static-section">
        <p className="section-label">Privacy</p>
        <h1 className="static-title">Privacy, in normal words.</h1>
        <div className="static-copy">
          <p>
            skim.page is a client-only prompt helper. It does not have user accounts, a database,
            article scraping, or in-app AI summarization.
          </p>
          <p>
            When you use a skim.page URL, the article URL appears in your browser address bar and
            is sent to skim.page hosting so the page can load. The generated prompt is created in
            your browser. If you open an AI app, that app receives the prompt and article URL
            according to its own product behavior and privacy policy.
          </p>
          <p>
            skim.page does not intentionally store prompts or article URLs. Browser history,
            server/CDN logs, referrers, and third-party AI apps may still keep their own records.
          </p>
        </div>
        <div className="static-actions">
          <a className="action-button action-primary" href="/">
            Back home
          </a>
          <a className="action-button" href={SOURCE_URL} rel="noreferrer" target="_blank">
            View source
          </a>
          <a className="action-button" href={FEEDBACK_URL} rel="noreferrer" target="_blank">
            Send feedback
          </a>
        </div>
      </section>
    </main>
  );
}

function Footer() {
  return (
    <footer>
      <div className="footer-logo">
        skim<span>.</span>page
      </div>
      <div className="footer-note">
        <a href="/privacy">Privacy</a>
        <a href={SOURCE_URL} rel="noreferrer" target="_blank">
          Source
        </a>
        <a href={FEEDBACK_URL} rel="noreferrer" target="_blank">
          Feedback
        </a>
        <a href={`${SOURCE_URL}/commits/main`} rel="noreferrer" target="_blank">
          Changelog
        </a>
      </div>
    </footer>
  );
}

function isStaticPage(location: Location, pageName: string): boolean {
  const path = location.pathname.replace(/^\/+|\/+$/g, '');

  return path === pageName && !location.search;
}

function fallbackCopyText(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export default App;
