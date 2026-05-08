import { useEffect, useMemo, useRef, useState } from 'react';
import { buildPreviewPrompt, lensIds, lenses, type LensId } from './lenses';
import {
  DEFAULT_PROVIDER_ID,
  buildProviderPathPrefix,
  providerIds,
  providers,
  type ProviderId,
} from './providers';
import { parseLocation, type ParsedLocation } from './url';

const openedHandoffUrls = new Set<string>();

function App() {
  const parsedLocation = useMemo(() => parseLocation(window.location), []);
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
      {parsedLocation.kind === 'request' ? (
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
  const [prefixCopyLabel, setPrefixCopyLabel] = useState('Copy');
  const skimPrefix = buildSkimPrefix(activeProviderId, activeLensId);

  useEffect(() => {
    if (!isAutoCycling) {
      return;
    }

    const timer = window.setInterval(() => {
      onLensChange(lenses[getNextLensId(activeLensId)].id);
    }, 3600);

    return () => window.clearInterval(timer);
  }, [activeLensId, isAutoCycling, onLensChange]);

  function chooseLens(lensId: LensId) {
    setIsAutoCycling(false);
    onLensChange(lensId);
  }

  function chooseProvider(providerId: ProviderId) {
    setIsAutoCycling(false);
    onProviderChange(providerId);
  }

  async function copyPrefix() {
    const prefix = `https://${skimPrefix}`;

    try {
      await navigator.clipboard.writeText(prefix);
    } catch {
      fallbackCopyText(prefix);
    }

    setPrefixCopyLabel('Copied');
    window.setTimeout(() => setPrefixCopyLabel('Copy'), 1600);
  }

  return (
    <>
      <div className="landing-grid">
        <section className="hero">
          <div className="hero-eyebrow" id="hero-eyebrow">
            {activeLens.eyebrow}
          </div>
          <h1 className="hero-headline">
            TL;DR,
            <br />
            <em id="hero-em">your way.</em>
          </h1>
          <p className="hero-sub">
            Just add <code>{skimPrefix}</code> in front of any article URL in your browser. 
            Optionally, pick your preferred provider and pick a lens when you want a specific angle.
          </p>
          <div className="hero-demo">
            <span className="hero-demo-accent" id="demo-accent">
              {skimPrefix}
            </span>
            <span className="hero-demo-url">nytimes.com/...</span>
            <button className="hero-copy-button" onClick={copyPrefix} type="button">
              {prefixCopyLabel}
            </button>
          </div>
        </section>

        <section
          className="lenses-section"
          id="lenses"
          onMouseEnter={() => setIsAutoCycling(false)}
        >
          <div className="provider-control">
            <p className="section-label provider-label">Optional: Choose Your Provider</p>
            <div className="provider-tabs">
              {providerIds.map((providerId) => {
                const provider = providers[providerId];
                const isActive = providerId === activeProviderId;

                return (
                  <button
                    className="provider-tab"
                    key={provider.id}
                    onClick={() => chooseProvider(providerId)}
                    type="button"
                    aria-pressed={isActive}
                  >
                    <span className={isActive ? 'provider-dot provider-dot-active' : 'provider-dot'} />
                    {formatProviderTabLabel(providerId)}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="section-label lens-label">Optional: Choose your Lens</p>
          <div className="lens-tabs" id="lens-tabs">
            {lensIds.map((lensId) => {
              const lens = lenses[lensId];
              const isActive = lensId === activeLensId;

              return (
                <button
                  className="lens-tab"
                  data-lens={lensId}
                  key={lens.id}
                  onClick={() => chooseLens(lensId)}
                  style={{
                    background: isActive ? lens.color : '#fff',
                    color: isActive ? '#fff' : '#888',
                    borderColor: isActive ? lens.color : '#E0E0E0',
                  }}
                  type="button"
                >
                  {formatLensTabLabel(lens)}
                </button>
              );
            })}
          </div>
          <div className="lens-meta">
            <div className="lens-title" id="lens-title">
              {activeLens.title}
            </div>
            <div className="lens-desc" id="lens-desc">
              {activeLens.desc}
            </div>
          </div>
          <div className="prompt-block" id="prompt-block">
            {buildPreviewPrompt(activeLens)}
          </div>
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
                Just add <code>skim.page/</code> to the start of the URL. <br /><br />
                Optionally,<br /> pick provider:{' '} 
                <code>skim.page/cl/</code>  <br />
                pick lens:{' '} <code>skim.page/i/</code> <br /> 
                or both:{' '} <code>skim.page/cl/i/</code>.
                 <br /> 
              </div>
              <div className="shortcut-reference" aria-label="URL shortcuts">
                <div className="shortcut-note">Use the shortcut or full name.</div>
                <div className="shortcut-group">
                  <div className="shortcut-title">Providers</div>
                  <div className="shortcut-badges">
                    <span>ChatGPT (default)</span>
                    <span><strong>ge</strong> Gemini</span>
                    <span><strong>cl</strong> Claude</span>
                    <span><strong>px</strong> Perplexity</span>
                    <span><strong>gr</strong> Grok</span>
                  </div>
                </div>
                <div className="shortcut-group">
                  <div className="shortcut-title">Lens</div>
                  <div className="shortcut-badges">
                    <span><strong>e</strong> ELI5</span>
                    <span><strong>r</strong> Research</span>
                    <span><strong>i</strong> Investor</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="how-step">
              <div className="step-num accent-color">3</div>
              <div className="step-title">Get your TL;DR</div>
              <div className="step-body">
                Your AI app opens automatically. Copy fallback stays on skim.page.
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function getNextLensId(currentLensId: LensId): LensId {
  const currentIndex = lensIds.indexOf(currentLensId);
  const nextIndex = (currentIndex + 1) % lensIds.length;

  return lensIds[nextIndex];
}

function buildSkimPrefix(providerId: ProviderId, lensId: LensId): string {
  const providerPrefix = buildProviderPathPrefix(providerId);
  const lensSuffix = lenses[lensId].demoSuffix;

  return `skim.page${providerPrefix}${lensSuffix}/`;
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
  const [popupBlocked, setPopupBlocked] = useState(false);
  const promptRef = useRef<HTMLDivElement>(null);
  const didAutoOpen = useRef(false);
  const lens = lenses[request.lensId];
  const provider = providers[request.providerId];

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', lens.color);
    document.documentElement.style.setProperty('--accent-dim', hexToRgba(lens.color, 0.08));
  }, [lens.color]);

  useEffect(() => {
    if (
      request.handoffMode === 'copyOnly' ||
      didAutoOpen.current ||
      openedHandoffUrls.has(request.handoffUrl)
    ) {
      return;
    }

    didAutoOpen.current = true;
    openedHandoffUrls.add(request.handoffUrl);

    const popup = window.open(request.handoffUrl, '_blank');

    if (popup) {
      popup.opener = null;
      return;
    }

    setPopupBlocked(true);
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
            <strong>{popupBlocked ? 'Pop-up blocked.' : 'Opening automatically.'}</strong>
            <span>
              {popupBlocked
                ? ` Allow pop-ups and redirects for skim.page once, then ${provider.label} will open automatically next time.`
                : ` If ${provider.label} does not open, allow pop-ups and redirects for skim.page once.`}
            </span>
          </div>
        </div>
        <p className="section-label">Generated prompt</p>
        <div className="lens-meta">
          <div className="lens-title">{lens.title}</div>
          <div className="lens-desc">{lens.desc}</div>
        </div>
        <div className="result-provider">
          <span>Open in</span>
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
            rel="noreferrer"
            target="_blank"
          >
            Open {provider.label}
          </a>
          <button className="action-button" onClick={copyPrompt} type="button">
            {copyLabel}
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

function Footer() {
  return (
    <footer>
      <div className="footer-logo">
        skim<span>.</span>page
      </div>
      <div className="footer-note">Opens your AI app · No account needed · Free forever</div>
    </footer>
  );
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
