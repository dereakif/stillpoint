export const EPUB_READER_SETTINGS_SCHEMA_VERSION = 1;
export const EPUB_READER_SETTINGS_STORAGE_KEY = 'stillpoint.epubReaderSettings';

const FONT_FAMILIES = Object.freeze(['publisher', 'serif', 'sans', 'system']);
const FLOWS = Object.freeze(['paginated', 'scrolled-doc']);
const SPREADS = Object.freeze(['none', 'auto']);

export const DEFAULT_EPUB_READER_SETTINGS = Object.freeze({
  schemaVersion: EPUB_READER_SETTINGS_SCHEMA_VERSION,
  fontFamily: 'publisher',
  fontSize: 18,
  lineHeight: 1.5,
  marginHorizontal: 16,
  marginVertical: 8,
  flow: 'paginated',
  spread: 'none',
});

let fallbackValue = null;
let fallbackStorage = null;
let fallbackRequired = false;

const finiteNumber = (value, fallback) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const sanitizeChoice = (value, choices, fallback) =>
  choices.includes(value) ? value : fallback;

const sanitizeInteger = (value, minimum, maximum, fallback) => {
  const number = finiteNumber(value, fallback);
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
};

const sanitizeDecimal = (value, minimum, maximum, fallback) => {
  const number = finiteNumber(value, fallback);
  const clamped = Math.min(maximum, Math.max(minimum, number));
  return Math.round(clamped * 10) / 10;
};

const normalizeSettings = (value) => {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return {
    schemaVersion: EPUB_READER_SETTINGS_SCHEMA_VERSION,
    fontFamily: sanitizeChoice(
      source.fontFamily,
      FONT_FAMILIES,
      DEFAULT_EPUB_READER_SETTINGS.fontFamily
    ),
    fontSize: sanitizeInteger(
      source.fontSize,
      12,
      32,
      DEFAULT_EPUB_READER_SETTINGS.fontSize
    ),
    lineHeight: sanitizeDecimal(
      source.lineHeight,
      1.1,
      2.4,
      DEFAULT_EPUB_READER_SETTINGS.lineHeight
    ),
    marginHorizontal: sanitizeInteger(
      source.marginHorizontal,
      0,
      64,
      DEFAULT_EPUB_READER_SETTINGS.marginHorizontal
    ),
    marginVertical: sanitizeInteger(
      source.marginVertical,
      0,
      48,
      DEFAULT_EPUB_READER_SETTINGS.marginVertical
    ),
    flow: sanitizeChoice(source.flow, FLOWS, DEFAULT_EPUB_READER_SETTINGS.flow),
    spread: sanitizeChoice(
      source.spread,
      SPREADS,
      DEFAULT_EPUB_READER_SETTINGS.spread
    ),
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
      const stored = storage.getItem(EPUB_READER_SETTINGS_STORAGE_KEY);
      if (stored !== null) return stored;
      if (fallbackRequired && storage === fallbackStorage) return fallbackValue;
      return null;
    } catch {
      // Fall through to the in-memory copy when browser storage is blocked.
    }
  }
  return fallbackValue;
};

const writeStoredValue = (value) => {
  fallbackValue = value;
  const storage = browserStorage();
  fallbackStorage = storage;
  fallbackRequired = !storage;
  if (!storage) return;

  try {
    storage.setItem(EPUB_READER_SETTINGS_STORAGE_KEY, value);
  } catch {
    fallbackRequired = true;
    // The in-memory copy remains available when browser storage is blocked/full.
  }
};

export const loadEpubReaderSettings = () => {
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

export const saveEpubReaderSettings = (settings) => {
  const normalized = normalizeSettings(settings);
  writeStoredValue(JSON.stringify(normalized));
  return normalized;
};
