import {
  DEFAULT_READING_WPM,
  MAX_READING_WPM,
  MIN_READING_WPM,
  READING_WPM_STEP,
} from '../readingSpeed';

export const READING_SETTINGS_SCHEMA_VERSION = 1;
export const READING_SETTINGS_STORAGE_KEY = 'stillpoint.readingSettings';

export const PACING_PRESETS = Object.freeze({
  smooth: Object.freeze({
    punctuationPause: 'light',
    longWordTiming: 'subtle',
    accelerateFunctionWords: true,
  }),
  natural: Object.freeze({
    punctuationPause: 'normal',
    longWordTiming: 'balanced',
    accelerateFunctionWords: true,
  }),
  deliberate: Object.freeze({
    punctuationPause: 'strong',
    longWordTiming: 'generous',
    accelerateFunctionWords: false,
  }),
});

const PUNCTUATION_TIMING_OPTIONS = Object.freeze({
  light: Object.freeze({
    commaPauseMultiplier: 1.5,
    sentenceEndMultiplier: 2.2,
    paragraphEndMultiplier: 2.8,
    emDashMultiplier: 1.7,
  }),
  normal: Object.freeze({
    commaPauseMultiplier: 1.8,
    sentenceEndMultiplier: 2.6,
    paragraphEndMultiplier: 3.2,
    emDashMultiplier: 2,
  }),
  strong: Object.freeze({
    commaPauseMultiplier: 2.1,
    sentenceEndMultiplier: 3,
    paragraphEndMultiplier: 3.8,
    emDashMultiplier: 2.4,
  }),
});

const LONG_WORD_TIMING_OPTIONS = Object.freeze({
  subtle: Object.freeze({
    longWordMultiplier: 1.2,
    veryLongWordCharacterMultiplier: 0.03,
  }),
  balanced: Object.freeze({
    longWordMultiplier: 1.35,
    veryLongWordCharacterMultiplier: 0.05,
  }),
  generous: Object.freeze({
    longWordMultiplier: 1.5,
    veryLongWordCharacterMultiplier: 0.07,
  }),
});

const DEFAULT_SETTINGS = Object.freeze({
  schemaVersion: READING_SETTINGS_SCHEMA_VERSION,
  preset: 'natural',
  wpm: DEFAULT_READING_WPM,
  countdownSeconds: 3,
  rewindWords: 5,
  ...PACING_PRESETS.natural,
});

let fallbackValue = null;

const hasOwn = (value, property) =>
  Object.prototype.hasOwnProperty.call(value, property);

const finiteNumber = (value, fallback) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const sanitizeSteppedWpm = (value) => {
  const number = finiteNumber(value, DEFAULT_SETTINGS.wpm);
  const clamped = Math.min(MAX_READING_WPM, Math.max(MIN_READING_WPM, number));
  return Math.round(clamped / READING_WPM_STEP) * READING_WPM_STEP;
};

const sanitizeInteger = (value, minimum, maximum, fallback) => {
  const number = finiteNumber(value, fallback);
  return Math.min(maximum, Math.max(minimum, Math.round(number)));
};

const sanitizeChoice = (value, choices, fallback) =>
  choices.includes(value) ? value : fallback;

const normalizePresetName = (preset) => {
  if (typeof preset !== 'string') return null;
  const normalized = preset.toLowerCase();
  return hasOwn(PACING_PRESETS, normalized) ? normalized : null;
};

const normalizeSettings = (value) => {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const requestedPreset = normalizePresetName(source.preset);
  const presetDefaults = requestedPreset
    ? PACING_PRESETS[requestedPreset]
    : PACING_PRESETS.natural;
  const punctuationPause = sanitizeChoice(
    source.punctuationPause,
    Object.keys(PUNCTUATION_TIMING_OPTIONS),
    presetDefaults.punctuationPause
  );
  const longWordTiming = sanitizeChoice(
    source.longWordTiming,
    Object.keys(LONG_WORD_TIMING_OPTIONS),
    presetDefaults.longWordTiming
  );
  const accelerateFunctionWords =
    typeof source.accelerateFunctionWords === 'boolean'
      ? source.accelerateFunctionWords
      : presetDefaults.accelerateFunctionWords;
  const hasManualTiming =
    hasOwn(source, 'punctuationPause') ||
    hasOwn(source, 'longWordTiming') ||
    hasOwn(source, 'accelerateFunctionWords');
  const matchesRequestedPreset =
    requestedPreset !== null &&
    punctuationPause === presetDefaults.punctuationPause &&
    longWordTiming === presetDefaults.longWordTiming &&
    accelerateFunctionWords === presetDefaults.accelerateFunctionWords;
  const preset =
    source.preset === 'custom' ||
    (hasManualTiming && !matchesRequestedPreset) ||
    (!requestedPreset && hasManualTiming)
      ? 'custom'
      : (requestedPreset ?? DEFAULT_SETTINGS.preset);

  return {
    schemaVersion: READING_SETTINGS_SCHEMA_VERSION,
    preset,
    wpm: sanitizeSteppedWpm(source.wpm),
    countdownSeconds: sanitizeInteger(
      source.countdownSeconds,
      0,
      5,
      DEFAULT_SETTINGS.countdownSeconds
    ),
    rewindWords: sanitizeInteger(
      source.rewindWords,
      1,
      15,
      DEFAULT_SETTINGS.rewindWords
    ),
    punctuationPause,
    longWordTiming,
    accelerateFunctionWords,
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
      return storage.getItem(READING_SETTINGS_STORAGE_KEY);
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
    storage.setItem(READING_SETTINGS_STORAGE_KEY, value);
  } catch {
    // The in-memory copy remains available when browser storage is blocked/full.
  }
};

export const loadReadingSettings = () => {
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

export const saveReadingSettings = (settings) => {
  const normalized = normalizeSettings(settings);
  writeStoredValue(JSON.stringify(normalized));
  return normalized;
};

export const applyPacingPreset = (settings, preset) => {
  const normalized = normalizeSettings(settings);
  const presetName = normalizePresetName(preset) ?? DEFAULT_SETTINGS.preset;

  return {
    ...normalized,
    preset: presetName,
    ...PACING_PRESETS[presetName],
  };
};

export const toEngineTimingOptions = (settings) => {
  const normalized = normalizeSettings(settings);
  return {
    ...PUNCTUATION_TIMING_OPTIONS[normalized.punctuationPause],
    ...LONG_WORD_TIMING_OPTIONS[normalized.longWordTiming],
    functionWordMultiplier: normalized.accelerateFunctionWords ? 0.75 : 1,
  };
};
