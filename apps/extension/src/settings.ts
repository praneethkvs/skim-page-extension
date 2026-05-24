import {
  DEFAULT_SKIM_SETTINGS,
  getBuiltInPromptStyle,
  getBuiltInPromptStyles,
  isBuiltInStyleId,
  isCustomStyleId,
  resolveLensId,
  resolveProviderId,
  type CustomPromptStyle,
  type CustomStyleId,
  type PromptStyle,
  type PromptStyleId,
  type SkimSettings,
} from '@skim-page/core';

const SETTINGS_KEY = 'skimPageSettings';
const CUSTOM_STYLES_KEY = 'skimPageCustomStyles';
const OPENAI_API_KEY = 'skimPageOpenAiApiKey';
const MAX_CUSTOM_STYLES = 12;

type StoredSettings = Partial<Record<keyof SkimSettings | 'lensId', unknown>>;

export type OpenAiSettings = Pick<
  SkimSettings,
  'inPageModeEnabled' | 'openaiModel' | 'openaiWebSearchEnabled'
>;

export type PromptStyleCatalog = {
  styles: PromptStyle[];
  customStyles: CustomPromptStyle[];
};

export async function loadSettings(): Promise<SkimSettings> {
  const [stored, customStyles] = await Promise.all([
    chrome.storage.sync.get({ [SETTINGS_KEY]: DEFAULT_SKIM_SETTINGS }),
    loadCustomStyles(),
  ]);
  const settings = stored[SETTINGS_KEY] as StoredSettings | undefined;

  return normalizeSettings(settings, customStyles);
}

export async function saveSettings(settings: Partial<SkimSettings>): Promise<void> {
  const currentSettings = await loadSettings();
  const customStyles = await loadCustomStyles();
  const nextSettings = normalizeSettings({ ...currentSettings, ...settings }, customStyles);

  await chrome.storage.sync.set({ [SETTINGS_KEY]: nextSettings });
}

export async function loadOpenAiSettings(): Promise<OpenAiSettings> {
  const settings = await loadSettings();

  return {
    inPageModeEnabled: settings.inPageModeEnabled,
    openaiModel: settings.openaiModel,
    openaiWebSearchEnabled: settings.openaiWebSearchEnabled,
  };
}

export async function saveOpenAiSettings(settings: Partial<OpenAiSettings>): Promise<void> {
  await saveSettings(settings);
}

export async function loadOpenAiApiKey(): Promise<string | null> {
  const stored = await chrome.storage.local.get({ [OPENAI_API_KEY]: '' });
  const value = stored[OPENAI_API_KEY];

  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function saveOpenAiApiKey(apiKey: string): Promise<void> {
  await chrome.storage.local.set({ [OPENAI_API_KEY]: apiKey.trim() });
}

export async function removeOpenAiApiKey(): Promise<void> {
  await chrome.storage.local.set({ [OPENAI_API_KEY]: '' });
}

export async function hasOpenAiApiKey(): Promise<boolean> {
  return Boolean(await loadOpenAiApiKey());
}

export async function loadPromptStyleCatalog(): Promise<PromptStyleCatalog> {
  const customStyles = await loadCustomStyles();

  return {
    styles: [
      ...customStyles.map((style) => ({ ...style, source: 'custom' as const })),
      ...getBuiltInPromptStyles(),
    ],
    customStyles,
  };
}

export async function loadPromptStyle(styleId: PromptStyleId): Promise<PromptStyle> {
  if (isBuiltInStyleId(styleId)) {
    return getBuiltInPromptStyle(styleId);
  }

  const customStyles = await loadCustomStyles();
  const customStyle = customStyles.find((style) => style.id === styleId);

  return customStyle
    ? { ...customStyle, source: 'custom' }
    : getBuiltInPromptStyle('default');
}

export async function createCustomStyle(title: string, prompt: string): Promise<CustomPromptStyle> {
  const customStyles = await loadCustomStyles();
  const nextStyle: CustomPromptStyle = {
    id: `custom:${Date.now().toString(36)}`,
    title: normalizeTitle(title),
    prompt: normalizePrompt(prompt),
  };

  const nextStyles = [...customStyles, nextStyle].slice(-MAX_CUSTOM_STYLES);
  await chrome.storage.sync.set({ [CUSTOM_STYLES_KEY]: nextStyles });

  return nextStyle;
}

export async function updateCustomStyle(
  styleId: CustomStyleId,
  updates: Pick<CustomPromptStyle, 'title' | 'prompt'>,
): Promise<CustomPromptStyle | null> {
  const customStyles = await loadCustomStyles();
  const styleIndex = customStyles.findIndex((style) => style.id === styleId);

  if (styleIndex === -1) {
    return null;
  }

  const nextStyle: CustomPromptStyle = {
    id: styleId,
    title: normalizeTitle(updates.title),
    prompt: normalizePrompt(updates.prompt),
  };
  const nextStyles = customStyles.map((style, index) => (index === styleIndex ? nextStyle : style));

  await chrome.storage.sync.set({ [CUSTOM_STYLES_KEY]: nextStyles });

  return nextStyle;
}

export async function deleteCustomStyle(styleId: CustomStyleId): Promise<void> {
  const customStyles = await loadCustomStyles();
  const nextStyles = customStyles.filter((style) => style.id !== styleId);
  const settings = await loadSettings();
  const nextSettings =
    settings.styleId === styleId
      ? { ...settings, styleId: DEFAULT_SKIM_SETTINGS.styleId }
      : settings;

  await chrome.storage.sync.set({
    [CUSTOM_STYLES_KEY]: nextStyles,
    [SETTINGS_KEY]: nextSettings,
  });
}

function normalizeSettings(
  settings: StoredSettings | undefined,
  customStyles: CustomPromptStyle[],
): SkimSettings {
  return {
    styleId: normalizeStyleId(settings?.styleId ?? settings?.lensId, customStyles),
    providerId:
      typeof settings?.providerId === 'string'
        ? resolveProviderId(settings.providerId)
        : DEFAULT_SKIM_SETTINGS.providerId,
    inPageModeEnabled:
      typeof settings?.inPageModeEnabled === 'boolean'
        ? settings.inPageModeEnabled
        : DEFAULT_SKIM_SETTINGS.inPageModeEnabled,
    openaiModel:
      typeof settings?.openaiModel === 'string' && settings.openaiModel.trim()
        ? settings.openaiModel.trim().slice(0, 80)
        : DEFAULT_SKIM_SETTINGS.openaiModel,
    openaiWebSearchEnabled:
      typeof settings?.openaiWebSearchEnabled === 'boolean'
        ? settings.openaiWebSearchEnabled
        : DEFAULT_SKIM_SETTINGS.openaiWebSearchEnabled,
  };
}

async function loadCustomStyles(): Promise<CustomPromptStyle[]> {
  const stored = await chrome.storage.sync.get({ [CUSTOM_STYLES_KEY]: [] });
  const customStyles = stored[CUSTOM_STYLES_KEY];

  return Array.isArray(customStyles)
    ? customStyles.map(normalizeCustomStyle).filter((style): style is CustomPromptStyle => Boolean(style))
    : [];
}

function normalizeStyleId(value: unknown, customStyles: CustomPromptStyle[]): PromptStyleId {
  if (typeof value !== 'string') {
    return DEFAULT_SKIM_SETTINGS.styleId;
  }

  if (isBuiltInStyleId(value)) {
    return value;
  }

  if (isCustomStyleId(value) && customStyles.some((style) => style.id === value)) {
    return value;
  }

  return resolveLensId(value);
}

function normalizeCustomStyle(value: unknown): CustomPromptStyle | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const maybeStyle = value as Partial<Record<keyof CustomPromptStyle, unknown>>;

  if (
    typeof maybeStyle.id !== 'string' ||
    !isCustomStyleId(maybeStyle.id) ||
    typeof maybeStyle.title !== 'string' ||
    typeof maybeStyle.prompt !== 'string'
  ) {
    return null;
  }

  return {
    id: maybeStyle.id,
    title: normalizeTitle(maybeStyle.title),
    prompt: normalizePrompt(maybeStyle.prompt),
  };
}

function normalizeTitle(title: string): string {
  return title.trim().slice(0, 48) || 'Custom style';
}

function normalizePrompt(prompt: string): string {
  return prompt.trim().slice(0, 2000);
}
