import { beforeEach, describe, expect, test } from 'bun:test';
import {
  NAVIGATION_SETTINGS_SCHEMA_VERSION,
  NAVIGATION_SETTINGS_STORAGE_KEY,
  loadNavigationSettings,
  saveNavigationSettings,
} from './navigationSettings';

const DEFAULT_SETTINGS = {
  schemaVersion: NAVIGATION_SETTINGS_SCHEMA_VERSION,
  centerTokenOnExit: true,
  entryHintDismissed: false,
  autoResumeOnOpen: false,
  rememberScrollPosition: true,
};

const BOOLEAN_SETTINGS = [
  'centerTokenOnExit',
  'entryHintDismissed',
  'autoResumeOnOpen',
  'rememberScrollPosition',
];

const LEGACY_ALIASES = {
  keepCurrentTokenCentered: 'centerTokenOnExit',
  immersiveEntryHintDismissed: 'entryHintDismissed',
  resumeAutomatically: 'autoResumeOnOpen',
  rememberDocumentScroll: 'rememberScrollPosition',
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

describe('navigation settings persistence', () => {
  test('returns versioned defaults when nothing is stored', () => {
    expect(loadNavigationSettings()).toEqual(DEFAULT_SETTINGS);
  });

  test('saves and reloads settings', () => {
    const saved = saveNavigationSettings({
      schemaVersion: 0,
      showTableOfContents: false,
      centerTokenOnExit: false,
      entryHintDismissed: true,
      autoResumeOnOpen: true,
      rememberScrollPosition: false,
      unknownSetting: true,
    });

    expect(saved).toEqual({
      schemaVersion: NAVIGATION_SETTINGS_SCHEMA_VERSION,
      centerTokenOnExit: false,
      entryHintDismissed: true,
      autoResumeOnOpen: true,
      rememberScrollPosition: false,
    });
    expect(loadNavigationSettings()).toEqual(saved);
    expect(
      JSON.parse(
        globalThis.localStorage.getItem(NAVIGATION_SETTINGS_STORAGE_KEY)
      )
    ).toEqual(saved);
  });

  test.each(BOOLEAN_SETTINGS)(
    'accepts both boolean values for %s',
    (property) => {
      expect(saveNavigationSettings({ [property]: false })[property]).toBe(
        false
      );
      expect(saveNavigationSettings({ [property]: true })[property]).toBe(true);
    }
  );

  test('repairs every non-boolean setting with its default', () => {
    expect(
      saveNavigationSettings({
        centerTokenOnExit: 'false',
        entryHintDismissed: null,
        autoResumeOnOpen: undefined,
        rememberScrollPosition: {},
      })
    ).toEqual(DEFAULT_SETTINGS);
  });

  test.each(Object.entries(LEGACY_ALIASES))(
    'migrates the %s legacy alias',
    (alias, property) => {
      globalThis.localStorage.setItem(
        NAVIGATION_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          schemaVersion: 0,
          [alias]: !DEFAULT_SETTINGS[property],
        })
      );

      const loaded = loadNavigationSettings();
      expect(loaded[property]).toBe(!DEFAULT_SETTINGS[property]);
      expect(loaded.schemaVersion).toBe(NAVIGATION_SETTINGS_SCHEMA_VERSION);
      expect(
        JSON.parse(
          globalThis.localStorage.getItem(NAVIGATION_SETTINGS_STORAGE_KEY)
        )
      ).toEqual(loaded);
      expect(loaded).not.toHaveProperty(alias);
    }
  );

  test('migrates all legacy aliases together', () => {
    globalThis.localStorage.setItem(
      NAVIGATION_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 0,
        tableOfContentsVisible: false,
        keepCurrentTokenCentered: false,
        immersiveEntryHintDismissed: true,
        resumeAutomatically: true,
        rememberDocumentScroll: false,
      })
    );

    expect(loadNavigationSettings()).toEqual({
      schemaVersion: NAVIGATION_SETTINGS_SCHEMA_VERSION,
      centerTokenOnExit: false,
      entryHintDismissed: true,
      autoResumeOnOpen: true,
      rememberScrollPosition: false,
    });
  });

  test('drops retired table-of-contents visibility values', () => {
    const saved = saveNavigationSettings({
      showTableOfContents: false,
      tableOfContentsVisible: false,
    });

    expect(saved).toEqual(DEFAULT_SETTINGS);
    expect(saved).not.toHaveProperty('showTableOfContents');
    expect(saved).not.toHaveProperty('tableOfContentsVisible');
  });

  test('prefers valid canonical settings over legacy aliases', () => {
    expect(
      saveNavigationSettings({
        autoResumeOnOpen: false,
        resumeAutomatically: true,
      })
    ).toEqual(DEFAULT_SETTINGS);
  });

  test('uses a valid legacy alias when its canonical setting is invalid', () => {
    expect(
      saveNavigationSettings({
        centerTokenOnExit: 'invalid',
        keepCurrentTokenCentered: false,
      })
    ).toEqual({ ...DEFAULT_SETTINGS, centerTokenOnExit: false });
  });

  test('recovers from malformed JSON and rewrites defaults', () => {
    globalThis.localStorage.setItem(NAVIGATION_SETTINGS_STORAGE_KEY, '{broken');

    expect(loadNavigationSettings()).toEqual(DEFAULT_SETTINGS);
    expect(
      JSON.parse(
        globalThis.localStorage.getItem(NAVIGATION_SETTINGS_STORAGE_KEY)
      )
    ).toEqual(DEFAULT_SETTINGS);
  });

  test.each([[null], [[]], ['settings'], [42], [true]])(
    'recovers from the non-object value %p',
    (value) => {
      globalThis.localStorage.setItem(
        NAVIGATION_SETTINGS_STORAGE_KEY,
        JSON.stringify(value)
      );
      expect(loadNavigationSettings()).toEqual(DEFAULT_SETTINGS);
    }
  );

  test('sanitizes malformed input passed directly to save', () => {
    expect(saveNavigationSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(saveNavigationSettings(['not', 'settings'])).toEqual(
      DEFAULT_SETTINGS
    );
  });

  test('uses an in-memory fallback when localStorage access is blocked', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw new Error('blocked');
      },
    });

    const saved = saveNavigationSettings({ entryHintDismissed: true });

    expect(loadNavigationSettings()).toEqual(saved);
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

    const saved = saveNavigationSettings({
      centerTokenOnExit: false,
      autoResumeOnOpen: true,
    });
    expect(loadNavigationSettings()).toEqual(saved);
  });

  test('uses the fallback when writes fail but reads return no value', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error('blocked write');
        },
      },
    });

    const saved = saveNavigationSettings({ rememberScrollPosition: false });
    expect(loadNavigationSettings()).toEqual(saved);
  });
});
