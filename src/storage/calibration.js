export const CALIBRATION_PROFILE_SCHEMA_VERSION = 2;
export const CALIBRATION_PASSAGE_VERSION = 1;
export const CALIBRATION_STORAGE_KEY = 'stillpoint.calibrationProfile';

export const CALIBRATION_PASSAGE =
  'On a clear Saturday morning, Maya took the longer path to the neighborhood market. The route followed a narrow stream, passed a playground, and curved behind a row of old brick houses. She usually hurried, but today she noticed small details: a bicycle bell in the distance, sunlight moving across the water, and the smell of bread from a corner bakery. At the market, farmers arranged bright peppers, apples, and herbs beneath striped tents. Maya bought a loaf, two pears, and a bunch of mint. On her walk home, she stopped on a wooden bridge and watched a family of ducks drift through the reeds. The extra distance had added only a few minutes to her trip, yet the morning felt larger and more memorable. She decided that whenever time allowed, she would choose a route that gave her something new to notice.';

export const CALIBRATION_PASSAGE_WORD_COUNT =
  CALIBRATION_PASSAGE.trim().split(/\s+/).length;

const DEFAULT_WPM = 300;
const MIN_WPM = 100;
const MAX_WPM = 800;
const RECALIBRATION_WORD_THRESHOLD = 10000;
const RECALIBRATION_TIME_THRESHOLD_MS = 45 * 60 * 1000;
const POSTPONEMENT_MS = 7 * 24 * 60 * 60 * 1000;

let fallbackValue = null;

const clamp = (value, minimum, maximum) =>
  Math.min(maximum, Math.max(minimum, value));

const finiteNumber = (value, fallback = 0) => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const nonNegativeNumber = (value, fallback = 0) =>
  Math.max(0, finiteNumber(value, fallback));

const sanitizeWpm = (value, fallback = null) => {
  const number = finiteNumber(value, NaN);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(clamp(number, MIN_WPM, MAX_WPM) / 10) * 10;
};

const sanitizeDate = (value, fallback = null) => {
  if (value === null || value === undefined || value === '') return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
};

const dateFromNow = (now) => {
  const date = now === undefined ? new Date() : new Date(now);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const defaultProfile = () => ({
  schemaVersion: CALIBRATION_PROFILE_SCHEMA_VERSION,
  status: 'new',
  currentRecommendation: null,
  calibrationDate: null,
  passageVersion: null,
  history: [],
  periodicPrompts: {
    enabled: true,
    dismissed: false,
  },
  postponedUntil: null,
  readingStats: {
    wordsRead: 0,
    readingTimeMs: 0,
    baselineWordsRead: 0,
    baselineReadingTimeMs: 0,
    lastPromptDate: null,
  },
});

const sanitizeHistoryEntry = (entry) => {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;

  const elapsedMs = nonNegativeNumber(entry.elapsedMs);
  const measuredWpm = sanitizeWpm(
    entry.measuredWpm,
    elapsedMs > 0
      ? sanitizeWpm((CALIBRATION_PASSAGE_WORD_COUNT * 60000) / elapsedMs)
      : null
  );
  const recommendation = sanitizeWpm(entry.recommendation, measuredWpm);
  const acceptedWpm = sanitizeWpm(entry.acceptedWpm, recommendation);

  if (acceptedWpm === null) return null;

  return {
    completedAt: sanitizeDate(
      entry.completedAt ?? entry.calibrationDate,
      new Date(0).toISOString()
    ),
    passageVersion:
      Number.isInteger(entry.passageVersion) && entry.passageVersion > 0
        ? entry.passageVersion
        : CALIBRATION_PASSAGE_VERSION,
    elapsedMs,
    measuredWpm,
    comprehensionCorrect: Boolean(entry.comprehensionCorrect),
    comfort: sanitizeComfort(entry.comfort),
    recommendation: recommendation ?? acceptedWpm,
    acceptedWpm,
  };
};

const sanitizeComfort = (comfort) => {
  if (['too-slow', 'comfortable', 'too-fast'].includes(comfort)) return comfort;
  if (comfort === 'faster' || comfort === 'slow') return 'too-slow';
  if (comfort === 'slower' || comfort === 'fast') return 'too-fast';
  return 'comfortable';
};

const normalizeProfile = (value) => {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const defaults = defaultProfile();
  const status = ['new', 'skipped', 'completed'].includes(source.status)
    ? source.status
    : defaults.status;
  const legacyHistory = source.results ?? source.calibrationHistory;
  const historySource = Array.isArray(source.history)
    ? source.history
    : Array.isArray(legacyHistory)
      ? legacyHistory
      : [];
  const history = historySource
    .map(sanitizeHistoryEntry)
    .filter((entry) => entry !== null);
  const promptsSource =
    source.periodicPrompts && typeof source.periodicPrompts === 'object'
      ? source.periodicPrompts
      : {};
  const dismissed = Boolean(
    promptsSource.dismissed ?? source.recalibrationPromptsDismissed
  );
  const enabled = dismissed
    ? false
    : Boolean(promptsSource.enabled ?? source.periodicPromptsEnabled ?? true);
  const statsSource =
    source.readingStats && typeof source.readingStats === 'object'
      ? source.readingStats
      : {};
  const wordsRead = nonNegativeNumber(
    statsSource.wordsRead ?? source.cumulativeWordsRead
  );
  const readingTimeMs = nonNegativeNumber(
    statsSource.readingTimeMs ?? source.cumulativeReadingTimeMs
  );
  const baselineWordsRead = clamp(
    nonNegativeNumber(statsSource.baselineWordsRead),
    0,
    wordsRead
  );
  const baselineReadingTimeMs = clamp(
    nonNegativeNumber(statsSource.baselineReadingTimeMs),
    0,
    readingTimeMs
  );
  const currentRecommendation = sanitizeWpm(
    source.currentRecommendation ?? source.recommendation,
    history.at(-1)?.acceptedWpm ?? null
  );
  const latestDate = history.at(-1)?.completedAt ?? null;

  return {
    schemaVersion: CALIBRATION_PROFILE_SCHEMA_VERSION,
    status,
    currentRecommendation,
    calibrationDate: sanitizeDate(
      source.calibrationDate ?? source.completedAt,
      status === 'completed' ? latestDate : null
    ),
    passageVersion:
      Number.isInteger(source.passageVersion) && source.passageVersion > 0
        ? source.passageVersion
        : status === 'completed'
          ? (history.at(-1)?.passageVersion ?? CALIBRATION_PASSAGE_VERSION)
          : null,
    history,
    periodicPrompts: { enabled, dismissed },
    postponedUntil: sanitizeDate(source.postponedUntil),
    readingStats: {
      wordsRead,
      readingTimeMs,
      baselineWordsRead,
      baselineReadingTimeMs,
      lastPromptDate: sanitizeDate(statsSource.lastPromptDate),
    },
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
      return storage.getItem(CALIBRATION_STORAGE_KEY);
    } catch {
      // Fall through to the local in-memory copy.
    }
  }
  return fallbackValue;
};

const writeStoredValue = (value) => {
  fallbackValue = value;
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(CALIBRATION_STORAGE_KEY, value);
  } catch {
    // The in-memory copy remains available when browser storage is blocked/full.
  }
};

export const loadCalibrationProfile = () => {
  const stored = readStoredValue();
  if (!stored) return defaultProfile();

  try {
    const profile = normalizeProfile(JSON.parse(stored));
    writeStoredValue(JSON.stringify(profile));
    return profile;
  } catch {
    return defaultProfile();
  }
};

export const saveCalibrationProfile = (profile) => {
  const normalized = normalizeProfile(profile);
  writeStoredValue(JSON.stringify(normalized));
  return normalized;
};

export const calculateCalibrationRecommendation = ({
  elapsedMs,
  comprehensionCorrect,
  comfort,
} = {}) => {
  const elapsed = finiteNumber(elapsedMs, 0);
  if (elapsed <= 0) return DEFAULT_WPM;

  const measuredWpm = (CALIBRATION_PASSAGE_WORD_COUNT * 60000) / elapsed;
  const comprehensionFactor =
    typeof comprehensionCorrect === 'number'
      ? 0.8 + clamp(comprehensionCorrect, 0, 1) * 0.2
      : comprehensionCorrect
        ? 1
        : 0.8;
  const comfortFactor =
    typeof comfort === 'number'
      ? clamp(comfort, 0.8, 1.2)
      : sanitizeComfort(comfort) === 'too-slow'
        ? 1.1
        : sanitizeComfort(comfort) === 'too-fast'
          ? 0.9
          : 1;

  return sanitizeWpm(
    measuredWpm * comprehensionFactor * comfortFactor,
    DEFAULT_WPM
  );
};

export const completeCalibration = (profile, result = {}, acceptedWpm) => {
  const normalized = normalizeProfile(profile);
  const completedAt = dateFromNow(result.completedAt).toISOString();
  const elapsedMs = nonNegativeNumber(result.elapsedMs);
  const measuredWpm = sanitizeWpm(
    elapsedMs > 0
      ? (CALIBRATION_PASSAGE_WORD_COUNT * 60000) / elapsedMs
      : DEFAULT_WPM,
    DEFAULT_WPM
  );
  const recommendation = calculateCalibrationRecommendation(result);
  const accepted = sanitizeWpm(acceptedWpm, recommendation);
  const entry = {
    completedAt,
    passageVersion: CALIBRATION_PASSAGE_VERSION,
    elapsedMs,
    measuredWpm,
    comprehensionCorrect: Boolean(result.comprehensionCorrect),
    comfort: sanitizeComfort(result.comfort),
    recommendation,
    acceptedWpm: accepted,
  };

  return {
    ...normalized,
    status: 'completed',
    currentRecommendation: accepted,
    calibrationDate: completedAt,
    passageVersion: CALIBRATION_PASSAGE_VERSION,
    history: [...normalized.history, entry],
    postponedUntil: null,
    readingStats: {
      ...normalized.readingStats,
      baselineWordsRead: normalized.readingStats.wordsRead,
      baselineReadingTimeMs: normalized.readingStats.readingTimeMs,
    },
  };
};

export const skipInitialCalibration = (profile) => ({
  ...normalizeProfile(profile),
  status: 'skipped',
});

export const recordReadingActivity = (
  profile,
  { wordsRead, readingTimeMs } = {}
) => {
  const normalized = normalizeProfile(profile);
  return {
    ...normalized,
    readingStats: {
      ...normalized.readingStats,
      wordsRead:
        normalized.readingStats.wordsRead + nonNegativeNumber(wordsRead),
      readingTimeMs:
        normalized.readingStats.readingTimeMs +
        nonNegativeNumber(readingTimeMs),
    },
  };
};

export const shouldOfferRecalibration = (profile, now) => {
  const normalized = normalizeProfile(profile);
  if (
    normalized.status === 'new' ||
    !normalized.periodicPrompts.enabled ||
    normalized.periodicPrompts.dismissed
  ) {
    return false;
  }

  const currentTime = dateFromNow(now).getTime();
  const postponedUntil = sanitizeDate(normalized.postponedUntil);
  if (postponedUntil && new Date(postponedUntil).getTime() > currentTime) {
    return false;
  }

  const wordsSinceBaseline =
    normalized.readingStats.wordsRead -
    normalized.readingStats.baselineWordsRead;
  const timeSinceBaseline =
    normalized.readingStats.readingTimeMs -
    normalized.readingStats.baselineReadingTimeMs;

  return (
    wordsSinceBaseline >= RECALIBRATION_WORD_THRESHOLD ||
    timeSinceBaseline >= RECALIBRATION_TIME_THRESHOLD_MS
  );
};

export const postponeRecalibration = (profile, now) => {
  const normalized = normalizeProfile(profile);
  const promptDate = dateFromNow(now);
  return {
    ...normalized,
    postponedUntil: new Date(
      promptDate.getTime() + POSTPONEMENT_MS
    ).toISOString(),
    readingStats: {
      ...normalized.readingStats,
      lastPromptDate: promptDate.toISOString(),
    },
  };
};

export const dismissRecalibrationPrompts = (profile) => {
  const normalized = normalizeProfile(profile);
  return {
    ...normalized,
    periodicPrompts: {
      enabled: false,
      dismissed: true,
    },
    postponedUntil: null,
  };
};
