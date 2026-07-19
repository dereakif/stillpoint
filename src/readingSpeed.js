export const DEFAULT_READING_WPM = 300;
export const MIN_READING_WPM = 150;
export const MAX_READING_WPM = 600;
export const READING_WPM_STEP = 10;
export const MAX_CALIBRATION_RECOMMENDATION_WPM = 500;
export const MIN_CALIBRATION_RECOMMENDATION_WPM = 180;

export const clampReadingWpm = (
  value,
  minimum = MIN_READING_WPM,
  maximum = MAX_READING_WPM
) => {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue)
    ? numericValue
    : DEFAULT_READING_WPM;
  return Math.min(maximum, Math.max(minimum, safeValue));
};
