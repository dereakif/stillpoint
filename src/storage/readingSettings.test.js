import { beforeEach, describe, expect, test } from 'bun:test';
import {
  PACING_PRESETS,
  READING_SETTINGS_SCHEMA_VERSION,
  READING_SETTINGS_STORAGE_KEY,
  applyPacingPreset,
  loadReadingSettings,
  saveReadingSettings,
  toEngineTimingOptions,
} from './readingSettings';

const DEFAULT_SETTINGS = {
  schemaVersion: READING_SETTINGS_SCHEMA_VERSION,
  preset: 'natural',
  wpm: 300,
  countdownSeconds: 3,
  punctuationPause: 'normal',
  longWordTiming: 'balanced',
  accelerateFunctionWords: true,
};

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

describe('reading settings persistence', () => {
  test('returns versioned natural defaults when nothing is stored', () => {
    expect(loadReadingSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test('saves, sanitizes, and reloads settings', () => {
    const saved = saveReadingSettings({
      ...DEFAULT_SETTINGS,
      wpm: 347,
      countdownSeconds: 4,
      rewindWords: 9,
    });

    expect(saved).toEqual({
      ...DEFAULT_SETTINGS,
      wpm: 350,
      countdownSeconds: 4,
    });
    expect(saved).not.toHaveProperty('rewindWords');
    expect(loadReadingSettings()).toEqual(saved);
    expect(
      JSON.parse(globalThis.localStorage.getItem(READING_SETTINGS_STORAGE_KEY))
    ).toEqual(saved);
  });

  test('migrates a preset-only legacy value and updates its schema version', () => {
    globalThis.localStorage.setItem(
      READING_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 0,
        preset: 'deliberate',
        wpm: '412',
        countdownSeconds: '2',
        rewindWords: '7',
      })
    );

    expect(loadReadingSettings()).toEqual({
      schemaVersion: READING_SETTINGS_SCHEMA_VERSION,
      preset: 'deliberate',
      wpm: 410,
      countdownSeconds: 2,
      ...PACING_PRESETS.deliberate,
    });
  });

  test('clamps and rounds numeric settings and repairs invalid choices', () => {
    expect(
      saveReadingSettings({
        preset: 'natural',
        wpm: 9999,
        countdownSeconds: 99.4,
        rewindWords: -10,
        punctuationPause: 'invalid',
        longWordTiming: null,
        accelerateFunctionWords: 'yes',
      })
    ).toEqual({
      ...DEFAULT_SETTINGS,
      wpm: 600,
      countdownSeconds: 5,
    });

    expect(saveReadingSettings({ wpm: 1, countdownSeconds: -2 })).toEqual({
      ...DEFAULT_SETTINGS,
      wpm: 150,
      countdownSeconds: 0,
    });
    expect(saveReadingSettings({ wpm: 'not-a-number' })).toEqual(
      DEFAULT_SETTINGS
    );
  });

  test('marks explicit timing changes as custom', () => {
    const settings = saveReadingSettings({
      ...DEFAULT_SETTINGS,
      punctuationPause: 'strong',
      longWordTiming: 'subtle',
      accelerateFunctionWords: false,
    });

    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      preset: 'custom',
      punctuationPause: 'strong',
      longWordTiming: 'subtle',
      accelerateFunctionWords: false,
    });
  });

  test('recovers from malformed and non-object stored values', () => {
    globalThis.localStorage.setItem(READING_SETTINGS_STORAGE_KEY, '{broken');
    expect(loadReadingSettings()).toEqual(DEFAULT_SETTINGS);
    expect(
      JSON.parse(globalThis.localStorage.getItem(READING_SETTINGS_STORAGE_KEY))
    ).toEqual(DEFAULT_SETTINGS);

    globalThis.localStorage.setItem(
      READING_SETTINGS_STORAGE_KEY,
      JSON.stringify(['not', 'settings'])
    );
    expect(loadReadingSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test('uses an in-memory fallback when localStorage access is blocked', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });

    const saved = saveReadingSettings({
      ...DEFAULT_SETTINGS,
      wpm: 420,
      countdownSeconds: 1,
    });

    expect(loadReadingSettings()).toEqual(saved);
  });

  test('uses an in-memory fallback when localStorage methods throw', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error('blocked read');
        },
        setItem: () => {
          throw new Error('blocked write');
        },
      },
    });

    const saved = saveReadingSettings({ ...DEFAULT_SETTINGS, wpm: 420 });
    expect(loadReadingSettings()).toEqual(saved);
  });
});

describe('pacing presets', () => {
  test.each([
    [
      'smooth',
      {
        punctuationPause: 'light',
        longWordTiming: 'subtle',
        accelerateFunctionWords: true,
      },
    ],
    [
      'natural',
      {
        punctuationPause: 'normal',
        longWordTiming: 'balanced',
        accelerateFunctionWords: true,
      },
    ],
    [
      'deliberate',
      {
        punctuationPause: 'strong',
        longWordTiming: 'generous',
        accelerateFunctionWords: false,
      },
    ],
  ])('applies the %s preset', (preset, timing) => {
    const original = {
      ...DEFAULT_SETTINGS,
      preset: 'custom',
      wpm: 470,
      countdownSeconds: 5,
      punctuationPause: 'strong',
      longWordTiming: 'subtle',
      accelerateFunctionWords: false,
    };

    const applied = applyPacingPreset(original, preset);

    expect(applied).toEqual({
      ...DEFAULT_SETTINGS,
      preset,
      wpm: 470,
      countdownSeconds: 5,
      ...timing,
    });
    expect(original.preset).toBe('custom');
  });

  test('accepts display-case preset names and sanitizes the other settings', () => {
    expect(
      applyPacingPreset(
        { wpm: 346, countdownSeconds: 10, rewindWords: 0 },
        'Smooth'
      )
    ).toEqual({
      ...DEFAULT_SETTINGS,
      preset: 'smooth',
      wpm: 350,
      countdownSeconds: 5,
      ...PACING_PRESETS.smooth,
    });
  });
});

describe('engine timing options', () => {
  test('preserves the current natural engine defaults exactly', () => {
    expect(toEngineTimingOptions(DEFAULT_SETTINGS)).toEqual({
      commaPauseMultiplier: 1.8,
      sentenceEndMultiplier: 2.6,
      paragraphEndMultiplier: 3.2,
      emDashMultiplier: 2,
      longWordMultiplier: 1.35,
      veryLongWordCharacterMultiplier: 0.05,
      functionWordMultiplier: 0.75,
    });
  });

  test.each([
    ['light', [1.5, 2.2, 2.8, 1.7]],
    ['normal', [1.8, 2.6, 3.2, 2]],
    ['strong', [2.1, 3, 3.8, 2.4]],
  ])('maps %s punctuation timing', (punctuationPause, expected) => {
    const options = toEngineTimingOptions({ punctuationPause });
    expect([
      options.commaPauseMultiplier,
      options.sentenceEndMultiplier,
      options.paragraphEndMultiplier,
      options.emDashMultiplier,
    ]).toEqual(expected);
  });

  test.each([
    ['subtle', 1.2, 0.03],
    ['balanced', 1.35, 0.05],
    ['generous', 1.5, 0.07],
  ])(
    'maps %s long-word timing',
    (longWordTiming, longWordMultiplier, veryLongWordCharacterMultiplier) => {
      expect(toEngineTimingOptions({ longWordTiming })).toEqual(
        expect.objectContaining({
          longWordMultiplier,
          veryLongWordCharacterMultiplier,
        })
      );
    }
  );

  test('disables function-word acceleration with a neutral multiplier', () => {
    expect(
      toEngineTimingOptions({ accelerateFunctionWords: false })
        .functionWordMultiplier
    ).toBe(1);
    expect(
      toEngineTimingOptions({ accelerateFunctionWords: true })
        .functionWordMultiplier
    ).toBe(0.75);
  });

  test('maps every preset to a distinct complete engine configuration', () => {
    const mappings = Object.keys(PACING_PRESETS).map((preset) =>
      toEngineTimingOptions(applyPacingPreset(DEFAULT_SETTINGS, preset))
    );

    expect(new Set(mappings.map(JSON.stringify))).toHaveLength(3);
    for (const mapping of mappings)
      expect(Object.keys(mapping)).toHaveLength(7);
  });
});
