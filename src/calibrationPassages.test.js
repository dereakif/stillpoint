import { describe, expect, test } from 'bun:test';
import {
  CALIBRATION_PASSAGES,
  getCalibrationPassageWordCount,
} from './calibrationPassages';

const KEBAB_CASE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)+$/;

describe('CALIBRATION_PASSAGES', () => {
  test('contains exactly ten passages with unique IDs and texts', () => {
    expect(CALIBRATION_PASSAGES).toHaveLength(10);

    const ids = CALIBRATION_PASSAGES.map((passage) => passage.id);
    const texts = CALIBRATION_PASSAGES.map((passage) => passage.text);

    expect(new Set(ids).size).toBe(CALIBRATION_PASSAGES.length);
    expect(new Set(texts).size).toBe(CALIBRATION_PASSAGES.length);
    ids.forEach((id) => expect(id).toMatch(KEBAB_CASE_ID));
  });

  test('keeps every passage within the calibration word range', () => {
    CALIBRATION_PASSAGES.forEach((passage) => {
      expect(typeof passage.text).toBe('string');
      expect(passage.text.trim().length).toBeGreaterThan(0);
      expect(getCalibrationPassageWordCount(passage)).toBeGreaterThanOrEqual(
        140
      );
      expect(getCalibrationPassageWordCount(passage)).toBeLessThanOrEqual(170);
    });
  });

  test('uses version one and valid comprehension questions', () => {
    CALIBRATION_PASSAGES.forEach((passage) => {
      expect(passage.version).toBe(1);
      expect(typeof passage.question.prompt).toBe('string');
      expect(passage.question.prompt.trim().length).toBeGreaterThan(0);
      expect(passage.question.options).toHaveLength(3);

      passage.question.options.forEach((option) => {
        expect(option).toHaveLength(2);
        expect(typeof option[0]).toBe('string');
        expect(option[0].length).toBeGreaterThan(0);
        expect(typeof option[1]).toBe('string');
        expect(option[1].length).toBeGreaterThan(0);
      });

      const values = passage.question.options.map(([value]) => value);
      expect(new Set(values).size).toBe(3);
      expect(
        values.filter((value) => value === passage.question.answer)
      ).toHaveLength(1);
    });
  });

  test('keeps passage lengths at a roughly similar difficulty', () => {
    const wordCounts = CALIBRATION_PASSAGES.map(getCalibrationPassageWordCount);

    expect(
      Math.max(...wordCounts) - Math.min(...wordCounts)
    ).toBeLessThanOrEqual(20);
  });
});
