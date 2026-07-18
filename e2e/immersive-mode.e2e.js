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
  await page.clock.fastForward(3000);

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
