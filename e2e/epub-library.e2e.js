import { expect, test } from '@playwright/test';

const openLibraryFromEmptyEditor = async (page) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
};

const getStoredEpubSummary = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('stillpoint-library', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction('documents', 'readonly');
          const recordsRequest = transaction.objectStore('documents').getAll();
          recordsRequest.onerror = () => reject(recordsRequest.error);
          recordsRequest.onsuccess = () => {
            const record = recordsRequest.result.find(
              (candidate) => candidate.kind === 'epub'
            );
            resolve(
              record
                ? {
                    kind: record.kind,
                    fileName: record.source?.fileName,
                    fileSize: record.source?.file?.size,
                    cfi: record.reading?.cfi,
                  }
                : null
            );
            database.close();
          };
        };
      })
  );

test('stores, reopens, exports, and deletes an imported EPUB', async ({
  page,
}) => {
  await openLibraryFromEmptyEditor(page);
  await page
    .getByLabel('Choose EPUB to import')
    .setInputFiles('e2e/fixtures/minimal.epub');

  await expect(
    page.getByRole('heading', { name: 'Stillpoint Test Book' })
  ).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel('Stillpoint Test Book reader')).toBeVisible();
  const firstPageText = page
    .frameLocator('iframe')
    .getByText(/Page 1 contains/);
  await expect(firstPageText).toBeVisible({ timeout: 15_000 });

  const openContents = page.getByRole('button', { name: 'Open contents' });
  await openContents.click();
  const contents = page.getByRole('dialog', { name: 'Table of contents' });
  await expect(contents).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(contents).toHaveCount(0);
  await expect(openContents).toBeFocused();

  await openContents.click();
  await contents.getByRole('button', { name: 'Chapter One' }).click();
  await expect(contents).toHaveCount(0);

  const pagination = page.getByRole('navigation', { name: 'Book pagination' });
  await pagination.getByRole('button', { name: 'Next page' }).click();
  await expect(
    pagination.getByText('Chapter One', { exact: true })
  ).toBeVisible({
    timeout: 15_000,
  });
  await expect(pagination.getByText(/Page \d+ of \d+/)).toBeVisible();
  await expect
    .poll(() => getStoredEpubSummary(page).then((record) => record?.cfi), {
      timeout: 15_000,
    })
    .toMatch(/^epubcfi\(/);

  const nextButtonCfi = (await getStoredEpubSummary(page)).cfi;
  await page.keyboard.press('ArrowRight');
  await expect
    .poll(() => getStoredEpubSummary(page).then((record) => record?.cfi), {
      timeout: 15_000,
    })
    .not.toBe(nextButtonCfi);

  await page.getByRole('button', { name: 'Library' }).click();
  await expect(
    page.getByText('Stillpoint Test Book', { exact: true })
  ).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await expect(
    page.getByText('Stillpoint Test Book', { exact: true })
  ).toBeVisible();

  const storedBook = await getStoredEpubSummary(page);
  expect(storedBook).toEqual({
    kind: 'epub',
    fileName: 'minimal.epub',
    fileSize: expect.any(Number),
    cfi: expect.stringMatching(/^epubcfi\(/),
  });
  expect(storedBook.fileSize).toBeGreaterThan(0);

  const epubDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Export Stillpoint Test Book' })
    .click();
  expect((await epubDownload).suggestedFilename()).toBe('minimal.epub');

  await page.getByRole('button', { name: /^Stillpoint Test Book/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Stillpoint Test Book' })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Library' }).click();

  await page
    .getByRole('button', { name: 'Delete Stillpoint Test Book' })
    .click();
  await page
    .getByRole('alertdialog', { name: 'Delete document' })
    .getByRole('button', { name: 'Delete permanently' })
    .click();
  await expect(page.getByText('No saved documents yet')).toBeVisible();
});
