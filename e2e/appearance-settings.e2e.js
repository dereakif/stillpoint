import { expect, test } from '@playwright/test';

const saveDocument = async (page) => {
  await page
    .getByPlaceholder('Paste your text here...')
    .fill(
      '# Appearance Test\n\nA comfortable page keeps typography quiet while the reader follows the meaning.'
    );
  await page.getByRole('button', { name: 'Read document' }).click();
};

const openAppearance = async (page, theme = 'dark') => {
  await page
    .getByRole('button', { name: `Appearance settings: ${theme} theme` })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Appearance settings' });
  await expect(dialog).toBeVisible();
  return dialog;
};

test('previews appearance changes without applying canceled drafts', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page);
  const dialog = await openAppearance(page);

  await dialog.getByRole('button', { name: 'Light theme' }).click();
  await dialog.getByRole('button', { name: 'Sans document font' }).click();
  await dialog
    .getByRole('combobox', { name: 'Document width' })
    .selectOption('wide');
  await dialog
    .getByRole('combobox', { name: 'Document line height' })
    .selectOption('relaxed');
  await dialog
    .getByRole('combobox', { name: 'Immersive word size' })
    .selectOption('large');
  await dialog
    .getByRole('combobox', { name: 'ORP accent color' })
    .selectOption('cyan');

  await expect(dialog.getByTestId('appearance-preview')).toHaveCSS(
    'background-color',
    'rgb(250, 250, 248)'
  );
  await expect(
    dialog.getByTestId('appearance-preview').locator('.document-font-sans')
  ).toBeVisible();

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(
    page.getByRole('button', { name: 'Appearance settings: dark theme' })
  ).toBeVisible();
});

test('applies and restores document and immersive appearance', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page);
  const dialog = await openAppearance(page);

  await dialog.getByRole('button', { name: 'Sepia theme' }).click();
  await dialog.getByRole('button', { name: 'Serif document font' }).click();
  await dialog
    .getByRole('combobox', { name: 'Document width' })
    .selectOption('narrow');
  await dialog
    .getByRole('combobox', { name: 'Document line height' })
    .selectOption('compact');
  await dialog
    .getByRole('combobox', { name: 'Immersive word size' })
    .selectOption('large');
  await dialog
    .getByRole('combobox', { name: 'ORP accent color' })
    .selectOption('amber');
  await dialog.getByRole('checkbox', { name: 'Reduce visual effects' }).check();
  await dialog.getByRole('button', { name: 'Apply appearance' }).click();

  const root = page.locator('html');
  await expect(root).toHaveAttribute('data-theme', 'sepia');
  await expect(root).toHaveAttribute('data-orp-accent', 'amber');
  await expect(root).toHaveAttribute('data-reduced-effects', 'true');

  const article = page.getByRole('article', { name: 'Document content' });
  await expect(article).toHaveClass(/max-w-2xl/);
  await expect(article).toHaveClass(/document-font-serif/);
  await expect(article).toHaveClass(/leading-7/);

  await page.clock.install();
  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await page.clock.fastForward(3800);
  await expect(page.getByTestId('current-word')).toHaveClass(/text-4xl/);
  await expect(page.getByTestId('word-pivot')).toHaveCSS(
    'color',
    'rgb(138, 75, 8)'
  );

  await page.keyboard.press('Escape');
  await page.clock.fastForward(1000);
  await page.getByRole('button', { name: 'Open library' }).click();
  await page.reload();
  await page.getByRole('button', { name: /^Appearance Test/ }).click();

  await expect(root).toHaveAttribute('data-theme', 'sepia');
  const restored = await openAppearance(page, 'sepia');
  await expect(
    restored.getByRole('combobox', { name: 'Immersive word size' })
  ).toHaveValue('large');
  await expect(
    restored.getByRole('combobox', { name: 'ORP accent color' })
  ).toHaveValue('amber');
  await expect(
    restored.getByRole('checkbox', { name: 'Reduce visual effects' })
  ).toBeChecked();
});

test('offers every contrast-validated theme and accent', async ({ page }) => {
  await page.goto('/');
  await saveDocument(page);
  const dialog = await openAppearance(page);

  for (const theme of ['Dark', 'Light', 'Sepia']) {
    await expect(
      dialog.getByRole('button', { name: `${theme} theme` })
    ).toBeVisible();
  }

  const accent = dialog.getByRole('combobox', { name: 'ORP accent color' });
  await expect(accent.locator('option')).toHaveText([
    'Violet',
    'Cyan',
    'Amber',
    'Rose',
  ]);
});
