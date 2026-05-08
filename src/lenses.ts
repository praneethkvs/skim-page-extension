export type LensId = 'default' | 'eli5' | 'research' | 'investor';

export type Lens = {
  id: LensId;
  color: string;
  title: string;
  desc: string;
  eyebrow: string;
  shortAlias: string;
  aliases: string[];
  demoSuffix: string;
  prompt: string;
};

export const DEFAULT_LENS_ID: LensId = 'default';

export const lenses: Record<LensId, Lens> = {
  default: {
    id: 'default',
    color: '#E8390E',
    title: 'Default',
    desc: 'General-purpose summary',
    eyebrow: 'READ SMARTER',
    shortAlias: '',
    aliases: ['default', 'd'],
    demoSuffix: '',
    prompt: `Summarize this article briefly.

Provide:
- TLDR in 1-2 sentences
- 3 key takeaways
- Why it matters in 1 sentence`,
  },
  eli5: {
    id: 'eli5',
    color: '#9333EA',
    title: 'ELI5',
    desc: 'Plain language, no jargon',
    eyebrow: 'READ FASTER',
    shortAlias: 'e',
    aliases: ['eli5', 'e'],
    demoSuffix: '/e',
    prompt: `Explain this article in simple terms.

Provide:
- TLDR in 1-2 sentences
- Simple explanation in 3-5 bullets
- One real-world analogy
- Why it matters in 1 sentence`,
  },
  research: {
    id: 'research',
    color: '#0F8A5F',
    title: 'Research',
    desc: 'Structured academic analysis',
    eyebrow: 'READ DEEPER',
    shortAlias: 'r',
    aliases: ['research', 'r'],
    demoSuffix: '/r',
    prompt: `Analyze this article like a researcher.

Provide:
- TLDR in 1-2 sentences
- Main argument
- 3 key pieces of evidence or claims
- Any major assumptions or limitations
- One open question`,
  },
  investor: {
    id: 'investor',
    color: '#1D6AE8',
    title: 'Investor',
    desc: 'Market & financial lens',
    eyebrow: 'READ BETTER',
    shortAlias: 'i',
    aliases: ['investor', 'i'],
    demoSuffix: '/i',
    prompt: `Analyze this article from an investor perspective.

Provide:
- TLDR in 1-2 sentences
- Bull case in 2 bullets
- Bear case in 2 bullets
- Business or market implication
- Key metric, claim, or risk to watch`,
  },
};

export const lensIds = Object.keys(lenses) as LensId[];

export function resolveLensId(value: string | null | undefined): LensId {
  if (!value) {
    return DEFAULT_LENS_ID;
  }

  const normalized = value.toLowerCase();
  const lensId = lensIds.find((id) => lenses[id].aliases.includes(normalized));

  return lensId ?? DEFAULT_LENS_ID;
}

export function isLensAlias(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.toLowerCase();

  return lensIds.some((id) => lenses[id].aliases.includes(normalized));
}

export function buildPrompt(lens: Lens, articleUrl: string): string {
  return `${lens.prompt}\n\nArticle URL: ${articleUrl}`;
}

export function buildPreviewPrompt(lens: Lens): string {
  return buildPrompt(lens, '{ARTICLE_URL}');
}
