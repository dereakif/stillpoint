import { describe, expect, test } from 'bun:test';
import { APPEARANCE_THEMES, contrastRatio } from './appearanceThemes';

const HEX_COLOR = /^#[\dA-F]{6}$/i;
const THEME_NAMES = ['dark', 'light', 'sepia'];
const COLOR_NAMES = [
  'base100',
  'base200',
  'base300',
  'baseContent',
  'primary',
  'primaryContent',
  'secondary',
  'error',
  'violet',
  'cyan',
  'amber',
  'rose',
];
const ORP_ACCENTS = ['violet', 'cyan', 'amber', 'rose'];

describe('APPEARANCE_THEMES', () => {
  test('provides complete hex palettes for every supported theme', () => {
    expect(Object.keys(APPEARANCE_THEMES)).toEqual(THEME_NAMES);

    THEME_NAMES.forEach((themeName) => {
      const palette = APPEARANCE_THEMES[themeName];
      expect(Object.keys(palette)).toEqual(COLOR_NAMES);
      COLOR_NAMES.forEach((colorName) => {
        expect(palette[colorName]).toMatch(HEX_COLOR);
      });
    });
  });

  test.each(THEME_NAMES)('%s has readable core color pairs', (themeName) => {
    const palette = APPEARANCE_THEMES[themeName];

    expect(
      contrastRatio(palette.baseContent, palette.base100)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(palette.primary, palette.base100)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(palette.primaryContent, palette.primary)
    ).toBeGreaterThanOrEqual(4.5);
  });

  test.each(THEME_NAMES)(
    '%s keeps every ORP accent readable on its base',
    (themeName) => {
      const palette = APPEARANCE_THEMES[themeName];

      ORP_ACCENTS.forEach((accent) => {
        expect(
          contrastRatio(palette[accent], palette.base100)
        ).toBeGreaterThanOrEqual(4.5);
      });
    }
  );
});

describe('contrastRatio', () => {
  test('calculates standard WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBe(21);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
    expect(contrastRatio('#fff', '#000')).toBe(21);
  });

  test('rejects invalid color values', () => {
    expect(() => contrastRatio('white', '#000000')).toThrow(TypeError);
    expect(() => contrastRatio('#FFFF', '#000000')).toThrow(TypeError);
  });
});
