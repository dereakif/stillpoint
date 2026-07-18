import { expect, test } from '@playwright/test';

const CALIBRATION_STORAGE_KEY = 'stillpoint.calibrationProfile';

const saveDocument = async (page) => {
  await page
    .getByPlaceholder('Paste your text here...')
    .fill('# Calibration Test\n\none two three four five');
  await page.getByRole('button', { name: 'Read document' }).click();
};

const answerCalibration = async (page) => {
  await page.getByRole('button', { name: 'Start calibration' }).click();
  await expect(page.getByTestId('calibration-passage')).toBeVisible();
  await page.getByRole('button', { name: 'I finished the passage' }).click();
  await page.getByLabel('It gave her new things to notice.').check();
  await page.getByLabel('Comfortable and natural').check();
  await page.getByRole('button', { name: 'See recommendation' }).click();
};

const seedEligibleProfile = async (page) => {
  await page.addInitScript(
    ({ key }) => {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(
        key,
        JSON.stringify({
          schemaVersion: 2,
          status: 'completed',
          currentRecommendation: 320,
          calibrationDate: '2026-01-01T00:00:00.000Z',
          passageVersion: 1,
          history: [],
          periodicPrompts: { enabled: true, dismissed: false },
          postponedUntil: null,
          readingStats: {
            wordsRead: 10000,
            readingTimeMs: 0,
            baselineWordsRead: 0,
            baselineReadingTimeMs: 0,
            lastPromptDate: null,
          },
        })
      );
    },
    { key: CALIBRATION_STORAGE_KEY }
  );
};

test('completes calibration and applies an adjusted WPM', async ({ page }) => {
  await page.goto('/');
  await saveDocument(page);

  const offer = page.getByRole('complementary', {
    name: 'Optional reading pace calibration',
  });
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: 'Try calibration' }).click();
  await answerCalibration(page);

  const speed = page.getByRole('slider', {
    name: 'Adjust recommended reading speed',
  });
  await speed.fill('420');
  await page.getByRole('button', { name: 'Use 420 WPM' }).click();

  await expect(
    page.getByRole('button', {
      name: 'Reading settings and recalibrate: 420 WPM',
    })
  ).toBeVisible();
  await expect(
    page.getByRole('complementary', {
      name: 'Optional reading pace calibration',
    })
  ).toHaveCount(0);

  await page
    .getByRole('button', {
      name: 'Reading settings and recalibrate: 420 WPM',
    })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Find a comfortable reading pace' })
  ).toBeVisible();
  await expect(page.getByText('Previous accepted pace: 420 WPM')).toHaveCount(
    0
  );
});

test('can skip first-run calibration and reopen it explicitly', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page);

  const offer = page.getByRole('complementary', {
    name: 'Optional reading pace calibration',
  });
  await offer.getByRole('button', { name: 'Not now' }).click();
  await expect(offer).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: /^Calibration Test/ }).click();
  await expect(offer).toHaveCount(0);
  await page
    .getByRole('button', {
      name: 'Reading settings and recalibrate: 300 WPM',
    })
    .click();
  await expect(
    page.getByRole('dialog', { name: 'Find a comfortable reading pace' })
  ).toBeVisible();
});

test('retries the calibration passage without applying a result', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page);
  await page.getByRole('button', { name: 'Try calibration' }).click();
  await answerCalibration(page);

  await page.getByRole('button', { name: 'Retry' }).click();
  await expect(page.getByTestId('calibration-passage')).toBeVisible();
  await expect(
    page.getByRole('slider', { name: 'Adjust recommended reading speed' })
  ).toHaveCount(0);
});

test('postpones an eligible recalibration prompt', async ({ page }) => {
  await seedEligibleProfile(page);
  await page.goto('/');
  await saveDocument(page);

  const offer = page.getByRole('complementary', {
    name: 'Optional reading pace check-in',
  });
  await expect(offer).toBeVisible();
  await offer.getByRole('button', { name: 'Next week' }).click();
  await expect(offer).toHaveCount(0);

  await page.reload();
  await page.getByRole('button', { name: /^Calibration Test/ }).click();
  await expect(offer).toHaveCount(0);
});

test('permanently dismisses periodic recalibration prompts', async ({
  page,
}) => {
  await seedEligibleProfile(page);
  await page.goto('/');
  await saveDocument(page);

  const offer = page.getByRole('complementary', {
    name: 'Optional reading pace check-in',
  });
  await offer.getByRole('button', { name: 'Don’t ask again' }).click();
  await expect(offer).toHaveCount(0);

  const profile = await page.evaluate((key) => {
    return JSON.parse(window.localStorage.getItem(key));
  }, CALIBRATION_STORAGE_KEY);
  expect(profile.periodicPrompts).toEqual({ enabled: false, dismissed: true });
});
