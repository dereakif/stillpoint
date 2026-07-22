import { beforeEach, describe, expect, test } from 'bun:test';
import {
  DEFAULT_EPUB_READER_SETTINGS,
  EPUB_READER_SETTINGS_SCHEMA_VERSION,
  EPUB_READER_SETTINGS_STORAGE_KEY,
  loadEpubReaderSettings,
  saveEpubReaderSettings,
} from './epubReaderSettings';

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

describe('EPUB reader settings persistence', () => {
  test('exports immutable versioned defaults and returns them when empty', () => {
    expect(EPUB_READER_SETTINGS_SCHEMA_VERSION).toBe(1);
    expect(EPUB_READER_SETTINGS_STORAGE_KEY).toBe(
      'stillpoint.epubReaderSettings'
    );
    expect(DEFAULT_EPUB_READER_SETTINGS).toEqual({
      schemaVersion: 1,
      fontFamily: 'publisher',
      fontSize: 18,
      lineHeight: 1.5,
      marginHorizontal: 16,
      marginVertical: 8,
      flow: 'paginated',
      spread: 'none',
    });
    expect(Object.isFrozen(DEFAULT_EPUB_READER_SETTINGS)).toBe(true);
    expect(loadEpubReaderSettings()).toEqual(DEFAULT_EPUB_READER_SETTINGS);
  });

  test('saves, persists, and reloads normalized settings', () => {
    const saved = saveEpubReaderSettings({
      schemaVersion: 0,
      fontFamily: 'system',
      fontSize: 24,
      lineHeight: 1.8,
      marginHorizontal: 32,
      marginVertical: 20,
      flow: 'scrolled-doc',
      spread: 'auto',
      unknown: 'discarded',
    });

    expect(saved).toEqual({
      schemaVersion: EPUB_READER_SETTINGS_SCHEMA_VERSION,
      fontFamily: 'system',
      fontSize: 24,
      lineHeight: 1.8,
      marginHorizontal: 32,
      marginVertical: 20,
      flow: 'scrolled-doc',
      spread: 'auto',
    });
    expect(loadEpubReaderSettings()).toEqual(saved);
    expect(
      JSON.parse(
        globalThis.localStorage.getItem(EPUB_READER_SETTINGS_STORAGE_KEY)
      )
    ).toEqual(saved);
  });

  test.each([
    ['fontFamily', ['publisher', 'serif', 'sans', 'system']],
    ['flow', ['paginated', 'scrolled-doc']],
    ['spread', ['none', 'auto']],
  ])('accepts every supported %s choice', (property, choices) => {
    for (const choice of choices) {
      expect(saveEpubReaderSettings({ [property]: choice })[property]).toBe(
        choice
      );
    }
  });

  test('rounds and clamps numeric fields', () => {
    expect(
      saveEpubReaderSettings({
        fontSize: 11.6,
        lineHeight: 1.56,
        marginHorizontal: 64.8,
        marginVertical: -2,
      })
    ).toEqual({
      ...DEFAULT_EPUB_READER_SETTINGS,
      fontSize: 12,
      lineHeight: 1.6,
      marginHorizontal: 64,
      marginVertical: 0,
    });

    expect(
      saveEpubReaderSettings({
        fontSize: 40,
        lineHeight: 9,
        marginHorizontal: 7.5,
        marginVertical: 47.5,
      })
    ).toEqual({
      ...DEFAULT_EPUB_READER_SETTINGS,
      fontSize: 32,
      lineHeight: 2.4,
      marginHorizontal: 8,
      marginVertical: 48,
    });
  });

  test('normalizes finite numeric strings and defaults non-finite values', () => {
    expect(
      saveEpubReaderSettings({
        fontSize: '20.6',
        lineHeight: '1.24',
        marginHorizontal: Number.NaN,
        marginVertical: Number.POSITIVE_INFINITY,
      })
    ).toEqual({
      ...DEFAULT_EPUB_READER_SETTINGS,
      fontSize: 21,
      lineHeight: 1.2,
    });
  });

  test('migrates old versions and repairs malformed fields', () => {
    globalThis.localStorage.setItem(
      EPUB_READER_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 0,
        fontFamily: 'serif',
        fontSize: 'large',
        lineHeight: 1.77,
        marginHorizontal: null,
        marginVertical: {},
        flow: 'continuous',
        spread: 'auto',
        unknownSetting: true,
      })
    );

    const expected = {
      ...DEFAULT_EPUB_READER_SETTINGS,
      fontFamily: 'serif',
      lineHeight: 1.8,
      marginHorizontal: 0,
      spread: 'auto',
    };
    expect(loadEpubReaderSettings()).toEqual(expected);
    expect(
      JSON.parse(
        globalThis.localStorage.getItem(EPUB_READER_SETTINGS_STORAGE_KEY)
      )
    ).toEqual(expected);
  });

  test.each([null, undefined, true, 42, 'settings', ['not', 'settings']])(
    'normalizes malformed input %#',
    (value) => {
      expect(saveEpubReaderSettings(value)).toEqual(
        DEFAULT_EPUB_READER_SETTINGS
      );
    }
  );

  test('recovers from malformed JSON and rewrites defaults', () => {
    globalThis.localStorage.setItem(
      EPUB_READER_SETTINGS_STORAGE_KEY,
      '{broken'
    );

    expect(loadEpubReaderSettings()).toEqual(DEFAULT_EPUB_READER_SETTINGS);
    expect(
      JSON.parse(
        globalThis.localStorage.getItem(EPUB_READER_SETTINGS_STORAGE_KEY)
      )
    ).toEqual(DEFAULT_EPUB_READER_SETTINGS);
  });

  test('normalizes parsed non-object values', () => {
    for (const value of [null, false, 7, 'settings', ['settings']]) {
      globalThis.localStorage.setItem(
        EPUB_READER_SETTINGS_STORAGE_KEY,
        JSON.stringify(value)
      );
      expect(loadEpubReaderSettings()).toEqual(DEFAULT_EPUB_READER_SETTINGS);
    }
  });

  test('uses memory when localStorage property access is blocked', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });

    const saved = saveEpubReaderSettings({
      fontFamily: 'sans',
      fontSize: 22,
      flow: 'scrolled-doc',
    });
    expect(loadEpubReaderSettings()).toEqual(saved);
  });

  test('uses memory when localStorage methods throw', () => {
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

    const saved = saveEpubReaderSettings({
      lineHeight: 2.1,
      marginHorizontal: 40,
      spread: 'auto',
    });
    expect(loadEpubReaderSettings()).toEqual(saved);
  });

  test('falls back after a write failure even when reads return null', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('full');
        },
      },
    });

    const saved = saveEpubReaderSettings({ fontSize: 26 });
    expect(loadEpubReaderSettings()).toEqual(saved);
  });

  test('does not leak fallback settings into a replacement storage instance', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });
    saveEpubReaderSettings({ fontFamily: 'sans', fontSize: 30 });

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: createStorage(),
    });
    expect(loadEpubReaderSettings()).toEqual(DEFAULT_EPUB_READER_SETTINGS);
  });
});
