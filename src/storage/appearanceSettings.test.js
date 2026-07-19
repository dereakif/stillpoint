import { beforeEach, describe, expect, test } from 'bun:test';
import {
  APPEARANCE_SETTINGS_SCHEMA_VERSION,
  APPEARANCE_SETTINGS_STORAGE_KEY,
  loadAppearanceSettings,
  saveAppearanceSettings,
} from './appearanceSettings';

const DEFAULT_SETTINGS = {
  schemaVersion: APPEARANCE_SETTINGS_SCHEMA_VERSION,
  theme: 'dark',
  documentFont: 'serif',
  documentWidth: 'comfortable',
  lineHeight: 'comfortable',
  immersiveWordSize: 'medium',
  orpAccent: 'violet',
  reducedEffects: false,
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

describe('appearance settings persistence', () => {
  test('returns versioned defaults when nothing is stored', () => {
    expect(loadAppearanceSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test('saves and reloads settings', () => {
    const saved = saveAppearanceSettings({
      theme: 'sepia',
      documentFont: 'system',
      documentWidth: 'wide',
      lineHeight: 'relaxed',
      immersiveWordSize: 'large',
      orpAccent: 'amber',
      reducedEffects: true,
    });

    expect(saved).toEqual({
      schemaVersion: APPEARANCE_SETTINGS_SCHEMA_VERSION,
      theme: 'sepia',
      documentFont: 'system',
      documentWidth: 'wide',
      lineHeight: 'relaxed',
      immersiveWordSize: 'large',
      orpAccent: 'amber',
      reducedEffects: true,
    });
    expect(loadAppearanceSettings()).toEqual(saved);
    expect(
      JSON.parse(
        globalThis.localStorage.getItem(APPEARANCE_SETTINGS_STORAGE_KEY)
      )
    ).toEqual(saved);
  });

  test.each([
    ['theme', ['dark', 'light', 'sepia']],
    ['documentFont', ['serif', 'sans', 'system']],
    ['documentWidth', ['narrow', 'comfortable', 'wide']],
    ['lineHeight', ['compact', 'comfortable', 'relaxed']],
    ['immersiveWordSize', ['small', 'medium', 'large']],
    ['orpAccent', ['violet', 'cyan', 'amber', 'rose']],
    ['reducedEffects', [false, true]],
  ])('accepts every supported %s choice', (property, choices) => {
    choices.forEach((choice) => {
      expect(saveAppearanceSettings({ [property]: choice })[property]).toBe(
        choice
      );
    });
  });

  test('migrates old values and repairs malformed fields', () => {
    globalThis.localStorage.setItem(
      APPEARANCE_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 0,
        theme: 'light',
        documentFont: 'comic-sans',
        documentWidth: null,
        lineHeight: 'compact',
        immersiveWordSize: 42,
        orpAccent: 'green',
        reducedEffects: 'yes',
        unknownSetting: true,
      })
    );

    expect(loadAppearanceSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'light',
      lineHeight: 'compact',
    });
    expect(
      JSON.parse(
        globalThis.localStorage.getItem(APPEARANCE_SETTINGS_STORAGE_KEY)
      )
    ).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'light',
      lineHeight: 'compact',
    });
  });

  test('recovers from malformed JSON and non-object values', () => {
    globalThis.localStorage.setItem(APPEARANCE_SETTINGS_STORAGE_KEY, '{broken');
    expect(loadAppearanceSettings()).toEqual(DEFAULT_SETTINGS);

    globalThis.localStorage.setItem(
      APPEARANCE_SETTINGS_STORAGE_KEY,
      JSON.stringify(['not', 'settings'])
    );
    expect(loadAppearanceSettings()).toEqual(DEFAULT_SETTINGS);
    expect(saveAppearanceSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  test('uses an in-memory fallback when localStorage access is blocked', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });

    const saved = saveAppearanceSettings({
      theme: 'sepia',
      orpAccent: 'rose',
      reducedEffects: true,
    });

    expect(loadAppearanceSettings()).toEqual(saved);
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

    const saved = saveAppearanceSettings({
      theme: 'light',
      documentFont: 'sans',
    });
    expect(loadAppearanceSettings()).toEqual(saved);
  });
});
