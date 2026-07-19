export const NAVIGATION_SETTINGS_SCHEMA_VERSION = 2;
export const NAVIGATION_SETTINGS_STORAGE_KEY = 'stillpoint.navigationSettings';

const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: NAVIGATION_SETTINGS_SCHEMA_VERSION,

  centerTokenOnExit: true,
  entryHintDismissed: false,
  autoResumeOnOpen: false,
  rememberScrollPosition: true,
});

const LEGACY_ALIASES = Object.freeze({
  centerTokenOnExit: 'keepCurrentTokenCentered',
  entryHintDismissed: 'immersiveEntryHintDismissed',
  autoResumeOnOpen: 'resumeAutomatically',
  rememberScrollPosition: 'rememberDocumentScroll',
});

let fallbackValue = null;
let fallbackStorage = null;
let fallbackRequired = false;

const hasOwn = (value, property) =>
  Object.prototype.hasOwnProperty.call(value, property);

const sanitizeBoolean = (source, property) => {
  if (hasOwn(source, property) && typeof source[property] === 'boolean') {
    return source[property];
  }

  const alias = LEGACY_ALIASES[property];
  return hasOwn(source, alias) && typeof source[alias] === 'boolean'
    ? source[alias]
    : DEFAULT_SETTINGS[property];
};

const normalizeSettings = (value) => {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  return {
    schemaVersion: NAVIGATION_SETTINGS_SCHEMA_VERSION,

    centerTokenOnExit: sanitizeBoolean(source, 'centerTokenOnExit'),
    entryHintDismissed: sanitizeBoolean(source, 'entryHintDismissed'),
    autoResumeOnOpen: sanitizeBoolean(source, 'autoResumeOnOpen'),
    rememberScrollPosition: sanitizeBoolean(source, 'rememberScrollPosition'),
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
      const stored = storage.getItem(NAVIGATION_SETTINGS_STORAGE_KEY);
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
    storage.setItem(NAVIGATION_SETTINGS_STORAGE_KEY, value);
  } catch {
    fallbackRequired = true;
    // The in-memory copy remains available when browser storage is blocked/full.
  }
};

export const loadNavigationSettings = () => {
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

export const saveNavigationSettings = (settings) => {
  const normalized = normalizeSettings(settings);
  writeStoredValue(JSON.stringify(normalized));
  return normalized;
};
