import {
  CALIBRATION_PASSAGES,
  getCalibrationPassageWordCount,
} from '../calibrationPassages';
import {
  DEFAULT_READING_WPM,
  MAX_CALIBRATION_RECOMMENDATION_WPM,
  MAX_READING_WPM,
  MIN_CALIBRATION_RECOMMENDATION_WPM,
  MIN_READING_WPM,
  READING_WPM_STEP,
} from '../readingSpeed';

export const CALIBRATION_PROFILE_SCHEMA_VERSION = 4;
export const CALIBRATION_PASSAGE_VERSION = CALIBRATION_PASSAGES[0].version;
export const CALIBRATION_STORAGE_KEY = 'stillpoint.calibrationProfile';

// Legacy aliases retained for existing stored history and integrations.
export const CALIBRATION_PASSAGE = CALIBRATION_PASSAGES[0].text;
export const CALIBRATION_PASSAGE_WORD_COUNT = getCalibrationPassageWordCount(
  CALIBRATION_PASSAGES[0]
);

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
  return (
    Math.round(
      clamp(number, MIN_READING_WPM, MAX_READING_WPM) / READING_WPM_STEP
    ) * READING_WPM_STEP
  );
};

const sanitizeRecommendation = (value, fallback = null) => {
  const number = finiteNumber(value, NaN);
  if (!Number.isFinite(number)) return fallback;
  return (
    Math.round(
      clamp(
        number,
        MIN_CALIBRATION_RECOMMENDATION_WPM,
        MAX_CALIBRATION_RECOMMENDATION_WPM
      ) / READING_WPM_STEP
    ) * READING_WPM_STEP
  );
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
  const testedWpm = sanitizeWpm(
    entry.testedWpm ?? entry.measuredWpm,
    DEFAULT_READING_WPM
  );
  const recommendation = sanitizeRecommendation(
    entry.recommendation,
    testedWpm
  );
  const acceptedWpm = sanitizeWpm(entry.acceptedWpm, recommendation);

  if (acceptedWpm === null) return null;

  return {
    completedAt: sanitizeDate(
      entry.completedAt ?? entry.calibrationDate,
      new Date(0).toISOString()
    ),
    passageId:
      typeof entry.passageId === 'string' && entry.passageId
        ? entry.passageId
        : null,
    passageVersion:
      Number.isInteger(entry.passageVersion) && entry.passageVersion > 0
        ? entry.passageVersion
        : CALIBRATION_PASSAGE_VERSION,
    elapsedMs,
    testedWpm,
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
  testedWpm,
  comprehensionCorrect,
  comfort,
} = {}) => {
  const testedPace = sanitizeWpm(testedWpm, DEFAULT_READING_WPM);
  const comfortAdjustment =
    typeof comfort === 'number'
      ? Math.round((clamp(comfort, 0.8, 1.2) - 1) * 200)
      : sanitizeComfort(comfort) === 'too-slow'
        ? 40
        : sanitizeComfort(comfort) === 'too-fast'
          ? -40
          : 0;
  const comprehensionAdjustment =
    comprehensionCorrect === undefined
      ? 0
      : typeof comprehensionCorrect === 'number'
        ? comprehensionCorrect >= 0.75
          ? 0
          : -50
        : comprehensionCorrect
          ? 0
          : -50;

  return sanitizeRecommendation(
    testedPace + comfortAdjustment + comprehensionAdjustment,
    DEFAULT_READING_WPM
  );
};

export const completeCalibration = (profile, result = {}, acceptedWpm) => {
  const normalized = normalizeProfile(profile);
  const completedAt = dateFromNow(result.completedAt).toISOString();
  const elapsedMs = nonNegativeNumber(result.elapsedMs);
  const testedWpm = sanitizeWpm(result.testedWpm, DEFAULT_READING_WPM);
  const recommendation = calculateCalibrationRecommendation({
    ...result,
    testedWpm,
  });
  const accepted = sanitizeWpm(acceptedWpm, recommendation);
  const entry = {
    completedAt,
    passageId:
      typeof result.passageId === 'string' && result.passageId
        ? result.passageId
        : null,
    passageVersion:
      Number.isInteger(result.passageVersion) && result.passageVersion > 0
        ? result.passageVersion
        : CALIBRATION_PASSAGE_VERSION,
    elapsedMs,
    testedWpm,
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
    passageVersion: entry.passageVersion,
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
