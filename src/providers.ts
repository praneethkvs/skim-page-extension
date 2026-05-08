export type ProviderId = 'chatgpt' | 'gemini' | 'claude' | 'perplexity' | 'grok';

export type HandoffMode = 'prefill' | 'autoRun' | 'copyOnly';

export type Provider = {
  id: ProviderId;
  label: string;
  shortAlias: string;
  aliases: string[];
  handoffMode: HandoffMode;
  note: string;
  buildHandoffUrl: (prompt: string) => string;
};

export const DEFAULT_PROVIDER_ID: ProviderId = 'chatgpt';

export const providers: Record<ProviderId, Provider> = {
  chatgpt: {
    id: 'chatgpt',
    label: 'ChatGPT',
    shortAlias: 'ch',
    aliases: ['ch', 'chatgpt', 'openai'],
    handoffMode: 'prefill',
    note: 'Prompt should open prefilled.',
    buildHandoffUrl: (prompt) => `https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`,
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    shortAlias: 'ge',
    aliases: ['ge', 'gemini'],
    handoffMode: 'autoRun',
    note: 'Gemini opens through Google AI Mode search as a best-effort prompt handoff.',
    buildHandoffUrl: (prompt) =>
      `https://www.google.com/search?udm=50&q=${encodeURIComponent(prompt)}`,
  },
  claude: {
    id: 'claude',
    label: 'Claude',
    shortAlias: 'cl',
    aliases: ['cl', 'claude'],
    handoffMode: 'prefill',
    note: 'Prompt should open prefilled.',
    buildHandoffUrl: (prompt) => `https://claude.ai/new?q=${encodeURIComponent(prompt)}`,
  },
  perplexity: {
    id: 'perplexity',
    label: 'Perplexity',
    shortAlias: 'px',
    aliases: ['px', 'perplexity'],
    handoffMode: 'autoRun',
    note: 'This provider may run the prompt immediately.',
    buildHandoffUrl: (prompt) => `https://www.perplexity.ai/?q=${encodeURIComponent(prompt)}`,
  },
  grok: {
    id: 'grok',
    label: 'Grok',
    shortAlias: 'gr',
    aliases: ['gr', 'grok'],
    handoffMode: 'autoRun',
    note: 'This provider may run the prompt immediately.',
    buildHandoffUrl: (prompt) => `https://grok.com/?q=${encodeURIComponent(prompt)}`,
  },
};

export const providerIds = Object.keys(providers) as ProviderId[];

export function resolveProviderId(value: string | null | undefined): ProviderId {
  if (!value) {
    return DEFAULT_PROVIDER_ID;
  }

  const normalized = value.toLowerCase();
  const provider = providerIds.find((providerId) =>
    providers[providerId].aliases.includes(normalized),
  );

  return provider ?? DEFAULT_PROVIDER_ID;
}

export function isProviderAlias(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();

  return providerIds.some((providerId) => providers[providerId].aliases.includes(normalized));
}

export function buildProviderPathPrefix(providerId: ProviderId): string {
  if (providerId === DEFAULT_PROVIDER_ID) {
    return '';
  }

  return `/${providers[providerId].shortAlias}`;
}
