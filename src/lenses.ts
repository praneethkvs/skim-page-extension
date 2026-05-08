export type LensId = 'default' | 'investor' | 'research' | 'eli5';

export type Lens = {
  id: LensId;
  color: string;
  title: string;
  desc: string;
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
    demoSuffix: '',
    prompt: `Summarize this article and provide:
- TLDR
- Key takeaways
- Important insights
- Notable facts or statistics
- Why it matters
- Counterpoints or criticisms
- Simple explanation for a casual reader`,
  },
  investor: {
    id: 'investor',
    color: '#1D6AE8',
    title: 'Investor',
    desc: 'Market & financial lens',
    demoSuffix: '/investor',
    prompt: `Analyze this article from an investor and business perspective.

Provide:
- TLDR
- Bull case
- Bear case
- Revenue/business implications
- Competitive advantages or moats
- Risks and uncertainties
- Long-term implications
- Important statistics or claims
- What investors should pay attention to`,
  },
  research: {
    id: 'research',
    color: '#0F8A5F',
    title: 'Research',
    desc: 'Structured academic analysis',
    demoSuffix: '/research',
    prompt: `Analyze this article like a researcher or analyst.

Provide:
- TLDR
- Main thesis or argument
- Supporting evidence
- Assumptions
- Weaknesses or limitations
- Biases or potential blind spots
- Important data or claims
- Counterarguments
- Open questions needing further research`,
  },
  eli5: {
    id: 'eli5',
    color: '#9333EA',
    title: 'ELI5',
    desc: 'Plain language, no jargon',
    demoSuffix: '/eli5',
    prompt: `Explain this article in an extremely simple and intuitive way.

Provide:
- TLDR
- Simple explanation
- Real-world analogies
- Definitions of difficult terms
- Why this matters
- Key takeaways for a casual person`,
  },
};

export const lensIds = Object.keys(lenses) as LensId[];

export function resolveLensId(value: string | null | undefined): LensId {
  if (value && value in lenses) {
    return value as LensId;
  }

  return DEFAULT_LENS_ID;
}

export function buildPrompt(lens: Lens, articleUrl: string): string {
  return `${lens.prompt}\n\nArticle URL: ${articleUrl}`;
}

export function buildPreviewPrompt(lens: Lens): string {
  return buildPrompt(lens, '{ARTICLE_URL}');
}
