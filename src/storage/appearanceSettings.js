export const APPEARANCE_SETTINGS_SCHEMA_VERSION = 1;
export const APPEARANCE_SETTINGS_STORAGE_KEY = 'stillpoint.appearanceSettings';

const THEMES = Object.freeze(['dark', 'light', 'sepia']);
const DOCUMENT_FONTS = Object.freeze(['serif', 'sans', 'system']);
const DOCUMENT_WIDTHS = Object.freeze(['narrow', 'comfortable', 'wide']);
const LINE_HEIGHTS = Object.freeze(['compact', 'comfortable', 'relaxed']);
const IMMERSIVE_WORD_SIZES = Object.freeze(['small', 'medium', 'large']);
const ORP_ACCENTS = Object.freeze(['violet', 'cyan', 'amber', 'rose']);

const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: APPEARANCE_SETTINGS_SCHEMA_VERSION,
  theme: 'dark',
  documentFont: 'serif',
  documentWidth: 'comfortable',
  lineHeight: 'comfortable',
  immersiveWordSize: 'medium',
  orpAccent: 'violet',
  reducedEffects: false,
});

let fallbackValue = null;

const sanitizeChoice = (value, choices, fallback) =>
  choices.includes(value) ? value : fallback;

const normalizeSettings = (value) => {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return {
    schemaVersion: APPEARANCE_SETTINGS_SCHEMA_VERSION,
    theme: sanitizeChoice(source.theme, THEMES, DEFAULT_SETTINGS.theme),
    documentFont: sanitizeChoice(
      source.documentFont,
      DOCUMENT_FONTS,
      DEFAULT_SETTINGS.documentFont
    ),
    documentWidth: sanitizeChoice(
      source.documentWidth,
      DOCUMENT_WIDTHS,
      DEFAULT_SETTINGS.documentWidth
    ),
    lineHeight: sanitizeChoice(
      source.lineHeight,
      LINE_HEIGHTS,
      DEFAULT_SETTINGS.lineHeight
    ),
    immersiveWordSize: sanitizeChoice(
      source.immersiveWordSize,
      IMMERSIVE_WORD_SIZES,
      DEFAULT_SETTINGS.immersiveWordSize
    ),
    orpAccent: sanitizeChoice(
      source.orpAccent,
      ORP_ACCENTS,
      DEFAULT_SETTINGS.orpAccent
    ),
    reducedEffects:
      typeof source.reducedEffects === 'boolean'
        ? source.reducedEffects
        : DEFAULT_SETTINGS.reducedEffects,
  };
};

const browserStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

const readStoredValue = () => {
  const storage = browserStorage();
  if (storage) {
    try {
      return storage.getItem(APPEARANCE_SETTINGS_STORAGE_KEY);
    } catch {
      // Fall through to the in-memory copy when browser storage is blocked.
    }
  }
  return fallbackValue;
};

const writeStoredValue = (value) => {
  fallbackValue = value;
  const storage = browserStorage();
  if (!storage) return;

  try {
    storage.setItem(APPEARANCE_SETTINGS_STORAGE_KEY, value);
  } catch {
    // The in-memory copy remains available when browser storage is blocked/full.
  }
};

export const loadAppearanceSettings = () => {
  const stored = readStoredValue();
  if (!stored) return normalizeSettings();

  try {
    const settings = normalizeSettings(JSON.parse(stored));
    writeStoredValue(JSON.stringify(settings));
    return settings;
  } catch {
    const settings = normalizeSettings();
    writeStoredValue(JSON.stringify(settings));
    return settings;
  }
};

export const saveAppearanceSettings = (settings) => {
  const normalized = normalizeSettings(settings);
  writeStoredValue(JSON.stringify(normalized));
  return normalized;
};
