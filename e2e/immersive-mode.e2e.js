import { expect, test } from '@playwright/test';

const enterImmersiveMode = async (page, text = 'Focus begins here.') => {
  const documentInput = page.getByPlaceholder('Paste your text here...');
  await documentInput.fill(text);
  await page.getByRole('button', { name: 'Immerse' }).click();
};

test('enters immersive mode with the imported document', async ({ page }) => {
  await page.goto('/');

  const documentInput = page.getByPlaceholder('Paste your text here...');
  const immerseButton = page.getByRole('button', { name: 'Immerse' });

  await expect(immerseButton).toBeDisabled();
  await documentInput.fill('Focus begins here.');
  await expect(immerseButton).toBeEnabled();
  await immerseButton.click();

  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exit' })).toBeVisible();
  await expect(documentInput).not.toBeVisible();
});

test('exits immersive mode during the countdown', async ({ page }) => {
  await page.goto('/');
  await page.clock.install();
  await enterImmersiveMode(page);

  await expect(page.getByText('3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit' }).click();

  await expect(page.getByPlaceholder('Paste your text here...')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toHaveCount(0);
});

test('supports immersive keyboard controls', async ({ page }) => {
  await page.goto('/');
  await page.clock.install();
  await enterImmersiveMode(page, 'alpha beta gamma delta epsilon zeta');
  await page.clock.fastForward(3700);
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('Space');

  const currentWord = page.getByTestId('current-word');

  await page.keyboard.press('ArrowRight');
  await expect(currentWord).toHaveText('zeta');

  await page.keyboard.press('ArrowLeft');
  await expect(currentWord).toHaveText('alpha');

  const speedSlider = page.getByRole('slider', { name: 'Reading speed' });

  await page.keyboard.press('ArrowUp');
  await expect(speedSlider).toHaveValue('310');
  await page.keyboard.press('ArrowDown');
  await expect(speedSlider).toHaveValue('300');

  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('keeps long words inside the viewport with a centered pivot', async ({
  page,
}) => {
  const longWord = 'pneumonoultramicroscopicsilicovolcanoconiosis'.repeat(4);

  await page.goto('/');
  await enterImmersiveMode(page, longWord);

  const currentWord = page.getByTestId('current-word');
  await expect(currentWord).toHaveText(longWord);

  const metrics = await page.evaluate(() => {
    const viewport = document
      .querySelector('[data-testid="word-viewport"]')
      .getBoundingClientRect();
    const currentWordElement = document.querySelector(
      '[data-testid="current-word"]'
    );
    const pivot = document
      .querySelector('[data-testid="word-pivot"]')
      .getBoundingClientRect();
    const textRects = [...currentWordElement.children].map((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect();
    });

    return {
      viewportLeft: viewport.left,
      viewportRight: viewport.right,
      viewportCenter: viewport.left + viewport.width / 2,
      textLeft: Math.min(...textRects.map((rect) => rect.left)),
      textRight: Math.max(...textRects.map((rect) => rect.right)),
      pivotCenter: pivot.left + pivot.width / 2,
    };
  });

  expect(metrics.textLeft).toBeGreaterThanOrEqual(metrics.viewportLeft);
  expect(metrics.textRight).toBeLessThanOrEqual(metrics.viewportRight);
  expect(Math.abs(metrics.pivotCenter - metrics.viewportCenter)).toBeLessThan(
    1
  );
});

test('does not restart playback after exiting before delayed play', async ({
  page,
}) => {
  await page.goto('/');
  await page.clock.install();
  await enterImmersiveMode(page, 'alpha beta gamma delta');

  await page.clock.fastForward(3000);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.clock.fastForward(1000);

  await expect(page.getByPlaceholder('Paste your text here...')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toHaveCount(0);
});
