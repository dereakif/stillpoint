import { expect, test } from '@playwright/test';

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
