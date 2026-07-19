const freezeTheme = (theme) => Object.freeze(theme);

export const APPEARANCE_THEMES = Object.freeze({
  dark: freezeTheme({
    base100: '#111318',
    base200: '#191C23',
    base300: '#242833',
    baseContent: '#E8EAF0',
    primary: '#C4B5FD',
    primaryContent: '#21183D',
    secondary: '#67E8F9',
    error: '#FDA4AF',
    violet: '#C4B5FD',
    cyan: '#67E8F9',
    amber: '#FCD34D',
    rose: '#FDA4AF',
  }),
  light: freezeTheme({
    base100: '#FAFAF8',
    base200: '#F0F0EC',
    base300: '#E2E3DE',
    baseContent: '#25282D',
    primary: '#6D28D9',
    primaryContent: '#FFFFFF',
    secondary: '#0E7490',
    error: '#B91C1C',
    violet: '#6D28D9',
    cyan: '#0E7490',
    amber: '#92400E',
    rose: '#BE123C',
  }),
  sepia: freezeTheme({
    base100: '#F5EBD8',
    base200: '#EADDC5',
    base300: '#DCCBAE',
    baseContent: '#3F3328',
    primary: '#70407F',
    primaryContent: '#FFF9ED',
    secondary: '#166070',
    error: '#9B2C2C',
    violet: '#70407F',
    cyan: '#166070',
    amber: '#8A4B08',
    rose: '#9F3048',
  }),
});

const parseHexColor = (color) => {
  if (typeof color !== 'string')
    throw new TypeError('Color must be a hex string');

  const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color);
  if (!match) throw new TypeError(`Invalid hex color: ${color}`);

  const hex =
    match[1].length === 3
      ? [...match[1]].map((character) => character.repeat(2)).join('')
      : match[1];

  return [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16)
  );
};

const relativeLuminance = (color) => {
  const channels = parseHexColor(color).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

export const contrastRatio = (foreground, background) => {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
};
