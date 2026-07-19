import { beforeEach, describe, expect, test } from 'bun:test';
import {
  CALIBRATION_PASSAGE,
  CALIBRATION_PASSAGE_VERSION,
  CALIBRATION_PASSAGE_WORD_COUNT,
  CALIBRATION_PROFILE_SCHEMA_VERSION,
  CALIBRATION_STORAGE_KEY,
  calculateCalibrationRecommendation,
  completeCalibration,
  dismissRecalibrationPrompts,
  loadCalibrationProfile,
  postponeRecalibration,
  recordReadingActivity,
  saveCalibrationProfile,
  shouldOfferRecalibration,
  skipInitialCalibration,
} from './calibration';

const createStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    clear: () => values.clear(),
  };
};

beforeEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: createStorage(),
  });
});

describe('calibration passage', () => {
  test('has a stable version and representative length', () => {
    expect(CALIBRATION_PASSAGE_VERSION).toBe(1);
    expect(CALIBRATION_PASSAGE_WORD_COUNT).toBeGreaterThanOrEqual(140);
    expect(CALIBRATION_PASSAGE_WORD_COUNT).toBeLessThanOrEqual(170);
    expect(CALIBRATION_PASSAGE.split(/\s+/)).toHaveLength(
      CALIBRATION_PASSAGE_WORD_COUNT
    );
  });
});

describe('calculateCalibrationRecommendation', () => {
  test('keeps a comfortable, understood tested pace', () => {
    expect(
      calculateCalibrationRecommendation({
        testedWpm: 300,
        comprehensionCorrect: true,
        comfort: 'comfortable',
      })
    ).toBe(300);
  });

  test('adjusts for comprehension and comfort together', () => {
    expect(
      calculateCalibrationRecommendation({
        testedWpm: 300,
        comprehensionCorrect: false,
        comfort: 'too-fast',
      })
    ).toBe(210);
    expect(
      calculateCalibrationRecommendation({
        testedWpm: 300,
        comprehensionCorrect: true,
        comfort: 'too-slow',
      })
    ).toBe(340);
  });

  test('accepts a comprehension ratio and numeric comfort factor', () => {
    expect(
      calculateCalibrationRecommendation({
        testedWpm: 300,
        comprehensionCorrect: 0.5,
        comfort: 1.2,
      })
    ).toBe(290);
  });

  test('clamps extreme results and handles invalid timing safely', () => {
    expect(
      calculateCalibrationRecommendation({
        testedWpm: 600,
        comprehensionCorrect: true,
        comfort: 'too-slow',
      })
    ).toBe(500);
    expect(
      calculateCalibrationRecommendation({
        testedWpm: 150,
        comprehensionCorrect: false,
        comfort: 'too-fast',
      })
    ).toBe(180);
    expect(calculateCalibrationRecommendation()).toBe(300);
  });
});

describe('profile persistence and migration', () => {
  test('returns a new versioned profile when nothing is stored', () => {
    expect(loadCalibrationProfile()).toEqual({
      schemaVersion: CALIBRATION_PROFILE_SCHEMA_VERSION,
      status: 'new',
      currentRecommendation: null,
      calibrationDate: null,
      passageVersion: null,
      history: [],
      periodicPrompts: { enabled: true, dismissed: false },
      postponedUntil: null,
      readingStats: {
        wordsRead: 0,
        readingTimeMs: 0,
        baselineWordsRead: 0,
        baselineReadingTimeMs: 0,
        lastPromptDate: null,
      },
    });
  });

  test('saves and reloads a sanitized profile', () => {
    const saved = saveCalibrationProfile({
      status: 'completed',
      recommendation: 347,
      completedAt: '2026-01-02T12:00:00.000Z',
      passageVersion: 1,
      periodicPromptsEnabled: true,
      cumulativeWordsRead: 1250,
      cumulativeReadingTimeMs: 120000,
    });

    expect(saved.currentRecommendation).toBe(350);
    expect(loadCalibrationProfile()).toEqual(saved);
    expect(
      JSON.parse(globalThis.localStorage.getItem(CALIBRATION_STORAGE_KEY))
        .schemaVersion
    ).toBe(CALIBRATION_PROFILE_SCHEMA_VERSION);
  });

  test('migrates legacy history and sanitizes malformed fields', () => {
    globalThis.localStorage.setItem(
      CALIBRATION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        status: 'completed',
        recommendation: 5000,
        completedAt: 'not-a-date',
        results: [
          null,
          {
            completedAt: '2025-05-01T10:00:00Z',
            elapsedMs: 30000,
            comprehensionCorrect: 1,
            comfort: 'fast',
            recommendation: 412,
            acceptedWpm: 407,
          },
        ],
        periodicPrompts: { enabled: true, dismissed: true },
        postponedUntil: 'invalid',
        readingStats: {
          wordsRead: -4,
          readingTimeMs: '9000',
          baselineWordsRead: 99,
          baselineReadingTimeMs: 12000,
          lastPromptDate: 'invalid',
        },
      })
    );

    const profile = loadCalibrationProfile();

    expect(profile.schemaVersion).toBe(CALIBRATION_PROFILE_SCHEMA_VERSION);
    expect(profile.currentRecommendation).toBe(600);
    expect(profile.calibrationDate).toBe('2025-05-01T10:00:00.000Z');
    expect(profile.history).toHaveLength(1);
    expect(profile.history[0]).toEqual(
      expect.objectContaining({
        comfort: 'too-fast',
        recommendation: 410,
        acceptedWpm: 410,
      })
    );
    expect(profile.periodicPrompts).toEqual({
      enabled: false,
      dismissed: true,
    });
    expect(profile.postponedUntil).toBeNull();
    expect(profile.readingStats).toEqual({
      wordsRead: 0,
      readingTimeMs: 9000,
      baselineWordsRead: 0,
      baselineReadingTimeMs: 9000,
      lastPromptDate: null,
    });
  });

  test('recovers from malformed JSON and unavailable localStorage', () => {
    globalThis.localStorage.setItem(CALIBRATION_STORAGE_KEY, '{broken');
    expect(loadCalibrationProfile().status).toBe('new');

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });

    const saved = saveCalibrationProfile({ status: 'skipped' });
    expect(saved.status).toBe('skipped');
    expect(loadCalibrationProfile().status).toBe('skipped');
  });
});

describe('calibration lifecycle', () => {
  test('completes calibration, preserves history, and accepts an adjusted WPM', () => {
    const initial = recordReadingActivity(loadCalibrationProfile(), {
      wordsRead: 400,
      readingTimeMs: 90000,
    });
    const first = completeCalibration(
      initial,
      {
        elapsedMs: 30000,
        testedWpm: 300,
        comprehensionCorrect: true,
        comfort: 'comfortable',
        completedAt: '2026-02-01T10:00:00Z',
      },
      327
    );
    const second = completeCalibration(
      first,
      {
        elapsedMs: 30000,
        testedWpm: 400,
        comprehensionCorrect: false,
        comfort: 'too-fast',
        completedAt: '2026-03-01T10:00:00Z',
      },
      290
    );

    expect(first.status).toBe('completed');
    expect(first.currentRecommendation).toBe(330);
    expect(first.calibrationDate).toBe('2026-02-01T10:00:00.000Z');
    expect(first.passageVersion).toBe(CALIBRATION_PASSAGE_VERSION);
    expect(first.readingStats.baselineWordsRead).toBe(400);
    expect(first.readingStats.baselineReadingTimeMs).toBe(90000);
    expect(second.history).toHaveLength(2);
    expect(second.history[0].acceptedWpm).toBe(330);
    expect(second.history[1].acceptedWpm).toBe(290);
    expect(initial.status).toBe('new');
  });

  test('marks an initial calibration as skipped without mutating the input', () => {
    const profile = loadCalibrationProfile();
    const skipped = skipInitialCalibration(profile);

    expect(skipped.status).toBe('skipped');
    expect(profile.status).toBe('new');
  });
});

describe('reading activity and recalibration prompts', () => {
  test('accumulates valid activity without mutating the profile', () => {
    const profile = skipInitialCalibration(loadCalibrationProfile());
    const updated = recordReadingActivity(profile, {
      wordsRead: 250,
      readingTimeMs: 60000,
    });
    const updatedAgain = recordReadingActivity(updated, {
      wordsRead: 50,
      readingTimeMs: -100,
    });

    expect(updatedAgain.readingStats.wordsRead).toBe(300);
    expect(updatedAgain.readingStats.readingTimeMs).toBe(60000);
    expect(profile.readingStats.wordsRead).toBe(0);
  });

  test('offers recalibration after either meaningful activity threshold', () => {
    const profile = completeCalibration(
      loadCalibrationProfile(),
      { elapsedMs: 30000, comprehensionCorrect: true },
      300
    );

    expect(
      shouldOfferRecalibration(
        recordReadingActivity(profile, {
          wordsRead: 9999,
          readingTimeMs: 0,
        })
      )
    ).toBe(false);
    expect(
      shouldOfferRecalibration(
        recordReadingActivity(profile, {
          wordsRead: 10000,
          readingTimeMs: 0,
        })
      )
    ).toBe(true);
    expect(
      shouldOfferRecalibration(
        recordReadingActivity(profile, {
          wordsRead: 0,
          readingTimeMs: 45 * 60 * 1000,
        })
      )
    ).toBe(true);
  });

  test('measures activity from the baseline established at completion', () => {
    const active = recordReadingActivity(loadCalibrationProfile(), {
      wordsRead: 9500,
      readingTimeMs: 44 * 60 * 1000,
    });
    const calibrated = completeCalibration(
      active,
      { elapsedMs: 30000, comprehensionCorrect: true },
      300
    );

    expect(shouldOfferRecalibration(calibrated)).toBe(false);
    expect(
      shouldOfferRecalibration(
        recordReadingActivity(calibrated, {
          wordsRead: 500,
          readingTimeMs: 60000,
        })
      )
    ).toBe(false);
  });

  test('postpones an eligible prompt for seven days', () => {
    const eligible = recordReadingActivity(
      skipInitialCalibration(loadCalibrationProfile()),
      { wordsRead: 10000, readingTimeMs: 0 }
    );
    const postponed = postponeRecalibration(eligible, '2026-04-01T12:00:00Z');

    expect(postponed.postponedUntil).toBe('2026-04-08T12:00:00.000Z');
    expect(postponed.readingStats.lastPromptDate).toBe(
      '2026-04-01T12:00:00.000Z'
    );
    expect(shouldOfferRecalibration(postponed, '2026-04-08T11:59:59Z')).toBe(
      false
    );
    expect(shouldOfferRecalibration(postponed, '2026-04-08T12:00:00Z')).toBe(
      true
    );
  });

  test('permanently dismisses periodic prompts', () => {
    const eligible = recordReadingActivity(
      skipInitialCalibration(loadCalibrationProfile()),
      { wordsRead: 10000, readingTimeMs: 0 }
    );
    const dismissed = dismissRecalibrationPrompts(eligible);

    expect(dismissed.periodicPrompts).toEqual({
      enabled: false,
      dismissed: true,
    });
    expect(shouldOfferRecalibration(dismissed)).toBe(false);
  });
});
