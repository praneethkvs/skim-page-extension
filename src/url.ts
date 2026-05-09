import { buildPrompt, isLensAlias, lenses, resolveLensId, type LensId } from './lenses';
import {
  isProviderAlias,
  providers,
  resolveProviderId,
  type HandoffMode,
  type Provider,
  type ProviderId,
} from './providers';

export type ParsedLocation =
  | { kind: 'landing' }
  | {
      kind: 'request';
      lensId: LensId;
      providerId: ProviderId;
      provider: Provider;
      articleUrl: string;
      prompt: string;
      handoffUrl: string;
      handoffMode: HandoffMode;
    }
  | { kind: 'malformed'; message: string; example: string };

const EXAMPLE_URL = 'https://skim.page/i/cl/https://example.com/article';

export function parseLocation(location: Location): ParsedLocation {
  const params = new URLSearchParams(location.search);
  const queryUrl = params.get('url');
  const queryLens = params.get('lens');
  const queryProvider = params.get('provider');

  if (queryUrl) {
    return buildRequest(queryLens, queryProvider, queryUrl);
  }

  const rawPath = extractRawPath(location);

  if (!rawPath) {
    return { kind: 'landing' };
  }

  const { lensCandidate, providerCandidate, urlCandidate } = splitLensProviderAndUrl(rawPath);

  if (!urlCandidate) {
    return {
      kind: 'malformed',
      message: 'We could not detect an article URL after the selected summary style or AI app.',
      example: EXAMPLE_URL,
    };
  }

  return buildRequest(lensCandidate, providerCandidate, urlCandidate);
}

export function normalizeArticleUrl(rawUrl: string): string | null {
  const decoded = safelyDecode(rawUrl.trim());
  const withoutLeadingSlashes = decoded.replace(/^\/+/, '');
  const protocolNormalized = normalizeProtocolSlashes(withoutLeadingSlashes);
  const candidate = hasProtocol(protocolNormalized)
    ? protocolNormalized
    : `https://${protocolNormalized}`;

  try {
    const url = new URL(candidate);

    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function buildRequest(
  lensCandidate: string | null | undefined,
  providerCandidate: string | null | undefined,
  rawUrl: string,
): ParsedLocation {
  const articleUrl = normalizeArticleUrl(rawUrl);

  if (!articleUrl) {
    return {
      kind: 'malformed',
      message: 'We could not turn that input into a valid article URL.',
      example: EXAMPLE_URL,
    };
  }

  const lensId = resolveLensId(lensCandidate);
  const providerId = resolveProviderId(providerCandidate);
  const provider = providers[providerId];
  const prompt = buildPrompt(lenses[lensId], articleUrl);
  const handoffUrl = provider.buildHandoffUrl(prompt);

  return {
    kind: 'request',
    lensId,
    providerId,
    provider,
    articleUrl,
    prompt,
    handoffUrl,
    handoffMode: provider.handoffMode,
  };
}

function extractRawPath(location: Location): string {
  const afterOrigin = location.href.slice(location.origin.length);
  const withoutHash = afterOrigin.split('#')[0] ?? '';

  if (!withoutHash || withoutHash === '/' || withoutHash.startsWith('/?')) {
    return '';
  }

  return withoutHash.replace(/^\/+/, '');
}

function splitLensProviderAndUrl(rawPath: string): {
  lensCandidate: string | null;
  providerCandidate: string | null;
  urlCandidate: string;
} {
  const firstSlash = rawPath.indexOf('/');

  if (firstSlash === -1) {
    return {
      lensCandidate: null,
      providerCandidate: null,
      urlCandidate: rawPath,
    };
  }

  const firstSegment = rawPath.slice(0, firstSlash);
  const rest = rawPath.slice(firstSlash + 1);

  if (isLensAlias(firstSegment)) {
    return splitProviderAndUrl(rest, firstSegment);
  }

  if (isProviderAlias(firstSegment)) {
    return splitLensAndUrl(rest, firstSegment);
  }

  if (isLikelyUnsupportedProvider(rest)) {
    return splitLensAndUrl(rest, firstSegment);
  }

  return splitLensAndUrl(rawPath, null);
}

function splitProviderAndUrl(
  rawPath: string,
  lensCandidate: string | null,
): {
  lensCandidate: string | null;
  providerCandidate: string | null;
  urlCandidate: string;
} {
  const firstSlash = rawPath.indexOf('/');

  if (firstSlash === -1) {
    return {
      lensCandidate,
      providerCandidate: null,
      urlCandidate: rawPath,
    };
  }

  const firstSegment = rawPath.slice(0, firstSlash);
  const rest = rawPath.slice(firstSlash + 1);

  if (isProviderAlias(firstSegment)) {
    return {
      lensCandidate,
      providerCandidate: firstSegment,
      urlCandidate: rest,
    };
  }

  if (isLikelyUnsupportedProviderAlias(firstSegment, rest)) {
    return {
      lensCandidate,
      providerCandidate: firstSegment,
      urlCandidate: rest,
    };
  }

  return {
    lensCandidate,
    providerCandidate: null,
    urlCandidate: rawPath,
  };
}

function splitLensAndUrl(
  rawPath: string,
  providerCandidate: string | null,
): {
  lensCandidate: string | null;
  providerCandidate: string | null;
  urlCandidate: string;
} {
  const firstSlash = rawPath.indexOf('/');

  if (firstSlash === -1) {
    return {
      lensCandidate: null,
      providerCandidate,
      urlCandidate: rawPath,
    };
  }

  const firstSegment = rawPath.slice(0, firstSlash);
  const rest = rawPath.slice(firstSlash + 1);

  if (isLensAlias(firstSegment)) {
    return {
      lensCandidate: firstSegment,
      providerCandidate,
      urlCandidate: rest,
    };
  }

  if (isLikelyUnsupportedLens(firstSegment, rest)) {
    return {
      lensCandidate: firstSegment,
      providerCandidate,
      urlCandidate: rest,
    };
  }

  return {
    lensCandidate: null,
    providerCandidate,
    urlCandidate: rawPath,
  };
}

function hasProtocol(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizeProtocolSlashes(value: string): string {
  return value.replace(/^(https?):\/(?!\/)/i, '$1://');
}

function safelyDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isLikelyUnsupportedLens(firstSegment: string, rest: string): boolean {
  if (!firstSegment || firstSegment.includes('.') || firstSegment.includes(':')) {
    return false;
  }

  return isLikelyArticleStart(rest);
}

function isLikelyUnsupportedProvider(rest: string): boolean {
  const firstSlash = rest.indexOf('/');

  if (firstSlash === -1) {
    return false;
  }

  const possibleLens = rest.slice(0, firstSlash);
  const possibleUrl = rest.slice(firstSlash + 1);

  return isLensAlias(possibleLens) && isLikelyUnsupportedLens(possibleLens, possibleUrl);
}

function isLikelyUnsupportedProviderAlias(firstSegment: string, rest: string): boolean {
  if (!firstSegment || firstSegment.includes('.') || firstSegment.includes(':')) {
    return false;
  }

  return isLikelyArticleStart(rest);
}

function isLikelyArticleStart(value: string): boolean {
  const decodedValue = safelyDecode(value);

  return /^https?:\/\//i.test(decodedValue) || /^[^/\s]+\.[^/\s]+/.test(decodedValue);
}
