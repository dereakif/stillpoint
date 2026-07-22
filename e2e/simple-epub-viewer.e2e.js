import { expect, test } from '@playwright/test';

test('opens the isolated local EPUB viewer', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/epub-viewer');

  await expect(
    page.getByRole('heading', { name: 'Simple EPUB viewer' })
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Choose EPUB', exact: true })
  ).toBeVisible();
  await expect(
    page.getByLabel('Choose EPUB for simple viewer')
  ).toHaveAttribute('accept', '.epub,application/epub+zip');
  await expect(page.getByRole('link', { name: 'Stillpoint' })).toHaveAttribute(
    'href',
    '/'
  );
  expect(pageErrors).toEqual([]);
});
