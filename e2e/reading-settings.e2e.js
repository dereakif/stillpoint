import { expect, test } from '@playwright/test';

const saveDocument = async (page) => {
  await page
    .getByPlaceholder('Paste your text here...')
    .fill(
      '# Settings Test\n\nzero one two three four five six seven eight nine ten eleven twelve'
    );
  await page.getByRole('button', { name: 'Read document' }).click();
};

const openSettings = async (page, wpm = 300) => {
  await page
    .getByRole('button', { name: `Reading settings: ${wpm} WPM` })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Reading settings' });
  await expect(dialog).toBeVisible();
  return dialog;
};

test('previews draft timing without applying canceled changes', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page);
  const dialog = await openSettings(page);

  await dialog.getByRole('button', { name: 'Smooth' }).click();
  await expect(
    dialog.getByRole('slider', { name: 'Settings reading speed' })
  ).toHaveValue('300');
  await expect(
    dialog.getByText(/It does not change your 300 WPM/)
  ).toBeVisible();
  await dialog.getByText('Fine-tune reading rhythm').click();
  await expect(
    dialog.getByRole('combobox', { name: 'Punctuation pause strength' })
  ).toHaveValue('light');
  await expect(
    dialog.getByRole('combobox', { name: 'Long-word timing' })
  ).toHaveValue('subtle');
  await expect(
    dialog.getByRole('checkbox', {
      name: 'Accelerate common function words',
    })
  ).toBeChecked();

  await dialog
    .getByRole('slider', { name: 'Settings reading speed' })
    .fill('420');
  await dialog
    .getByRole('combobox', { name: 'Countdown duration' })
    .selectOption('1');

  await page.clock.install();
  await dialog.getByRole('button', { name: 'Preview timing' }).click();
  await expect(dialog.getByTestId('current-word')).toBeVisible();
  await expect(dialog.getByText('Previewing draft settings')).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Reading settings: 300 WPM' })
  ).toBeVisible();

  const reopened = await openSettings(page);
  await expect(
    reopened.getByRole('button', { name: 'Natural' })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    reopened.getByRole('slider', { name: 'Settings reading speed' })
  ).toHaveValue('300');
});

test('applies and restores pacing and countdown settings', async ({ page }) => {
  await page.goto('/');
  await saveDocument(page);
  const dialog = await openSettings(page);

  await dialog.getByRole('button', { name: 'Deliberate' }).click();
  await dialog
    .getByRole('slider', { name: 'Settings reading speed' })
    .fill('410');
  await dialog
    .getByRole('combobox', { name: 'Countdown duration' })
    .selectOption('1');
  await dialog.getByRole('button', { name: 'Apply settings' }).click();

  await expect(
    page.getByRole('button', { name: 'Reading settings: 410 WPM' })
  ).toBeVisible();

  await page.clock.install();
  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await expect(page.getByTestId('immersive-countdown')).toHaveText('1');
  await page.clock.fastForward(1700);
  await page.getByRole('button', { name: 'Pause' }).click();
  await page.keyboard.press('Escape');
  await page.clock.fastForward(1000);
  await page.getByRole('button', { name: 'Open library' }).click();
  await page.reload();
  await page.getByRole('button', { name: /^Settings Test/ }).click();
  const restored = await openSettings(page, 410);

  await expect(
    restored.getByRole('button', { name: 'Deliberate' })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    restored.getByRole('combobox', { name: 'Countdown duration' })
  ).toHaveValue('1');

  await restored.getByText('Fine-tune reading rhythm').click();
  await expect(
    restored.getByRole('combobox', { name: 'Punctuation pause strength' })
  ).toHaveValue('strong');
  await expect(
    restored.getByRole('combobox', { name: 'Long-word timing' })
  ).toHaveValue('generous');
  await expect(
    restored.getByRole('checkbox', {
      name: 'Accelerate common function words',
    })
  ).not.toBeChecked();
});

test('makes fine-tuned rhythm values the active custom settings', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page);
  const dialog = await openSettings(page);

  await dialog.getByText('Fine-tune reading rhythm').click();
  await dialog
    .getByRole('combobox', { name: 'Punctuation pause strength' })
    .selectOption('strong');
  await dialog
    .getByRole('combobox', { name: 'Long-word timing' })
    .selectOption('subtle');
  await dialog
    .getByRole('checkbox', { name: 'Accelerate common function words' })
    .uncheck();

  await expect(dialog.getByText(/Current rhythm: Custom/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Natural' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  await dialog.getByRole('button', { name: 'Apply settings' }).click();

  const saved = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem('stillpoint.readingSettings'))
  );
  expect(saved).toEqual(
    expect.objectContaining({
      preset: 'custom',
      punctuationPause: 'strong',
      longWordTiming: 'subtle',
      accelerateFunctionWords: false,
    })
  );
});
