import { expect, test } from '@playwright/test';

const saveDocument = async (page, source) => {
  await page.getByPlaceholder('Paste your text here...').fill(source);
  await page.getByRole('button', { name: 'Read document' }).click();
};

const openLibrary = async (page) => {
  await page.getByRole('button', { name: 'Open library' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
};

test('saves documents locally with title, progress, and last-opened metadata', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page, '# My Book\n\none two');
  await openLibrary(page);

  await expect(page.getByText('My Book', { exact: true })).toBeVisible();
  await expect(page.getByText(/Last opened/)).toBeVisible();
  await expect(
    page.getByRole('progressbar', { name: 'My Book progress' })
  ).toHaveAttribute('value', '25');
  await expect(page.getByText('25%', { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Nothing is uploaded by Stillpoint/)
  ).toBeVisible();
});

test('opens a saved document at its exact last reading position', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page, '# Position Test\n\none two three four');
  await page
    .locator('[data-block-id="paragraph-2"][data-token-offset="2"]')
    .click();
  await page.getByRole('button', { name: 'Exit' }).click();
  await openLibrary(page);

  await expect(
    page.getByRole('progressbar', { name: 'Position Test progress' })
  ).toHaveAttribute('value', '83');
  await page.getByRole('button', { name: /^Position Test/ }).click();

  const currentParagraph = page.locator('#paragraph-2');
  await expect(currentParagraph).toHaveAttribute('data-token-offset', '2');
  await expect(currentParagraph.locator('[data-token-offset="2"]')).toHaveText(
    'three'
  );
});

test('renames and deletes a document with confirmation', async ({ page }) => {
  await page.goto('/');
  await saveDocument(page, '# Original Title\n\ntext');
  await openLibrary(page);

  await page.getByRole('button', { name: 'Rename Original Title' }).click();
  const renameDialog = page.getByRole('dialog', { name: 'Rename document' });
  await expect(renameDialog).toBeVisible();
  await renameDialog
    .getByRole('textbox', { name: 'Document title' })
    .fill('Renamed Document');
  await renameDialog.getByRole('button', { name: 'Save title' }).click();
  await expect(
    page.getByText('Renamed Document', { exact: true })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Delete Renamed Document' }).click();
  const deleteDialog = page.getByRole('alertdialog', {
    name: 'Delete document',
  });
  await expect(deleteDialog).toContainText('Export it first');
  await deleteDialog
    .getByRole('button', { name: 'Delete permanently' })
    .click();

  await expect(page.getByText('No saved documents yet')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Export backup' })
  ).toBeDisabled();
});

test('exports individual documents and a complete library backup', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page, '# Export Me\n\nbackup text');
  await openLibrary(page);

  const documentDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export Export Me' }).click();
  expect((await documentDownload).suggestedFilename()).toBe(
    'Export-Me.stillpoint.json'
  );

  const libraryDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export backup' }).click();
  expect((await libraryDownload).suggestedFilename()).toBe(
    'stillpoint-library-backup.json'
  );
});

test('creates and lists multiple local documents', async ({ page }) => {
  await page.goto('/');
  await saveDocument(page, '# First Document\n\nfirst');
  await openLibrary(page);
  await page.getByRole('button', { name: 'New document' }).click();
  await saveDocument(page, '# Second Document\n\nsecond');
  await openLibrary(page);

  await expect(page.getByText('First Document', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Second Document', { exact: true })
  ).toBeVisible();
});

test('shows actionable feedback when local storage is unavailable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', {
      configurable: true,
      value: undefined,
    });
  });
  await page.goto('/');

  await expect(page.getByRole('alert')).toContainText(
    'Local document storage is unavailable'
  );
  await expect(page.getByPlaceholder('Paste your text here...')).toBeVisible();
});
