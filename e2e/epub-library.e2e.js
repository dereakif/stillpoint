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

test('applies and restores EPUB reader settings', async ({ page }) => {
  await openLibraryFromEmptyEditor(page);
  await page
    .getByLabel('Choose EPUB to import')
    .setInputFiles('e2e/fixtures/minimal.epub');

  await expect(
    page.frameLocator('iframe').getByText(/Page 1 contains/)
  ).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Next page' }).click();
  await expect
    .poll(() => getStoredEpubSummary(page).then((record) => record?.cfi), {
      timeout: 15_000,
    })
    .toMatch(/^epubcfi\(/);

  const settingsButton = page.getByRole('button', {
    name: 'Open reader settings',
  });
  await settingsButton.click();
  const settings = page.getByRole('dialog', { name: 'Reader settings' });
  await expect(settings).toBeVisible();

  await settings.getByLabel('EPUB font').selectOption('sans');
  await settings.getByRole('slider', { name: 'Font size' }).fill('24');
  await settings.getByRole('slider', { name: 'Line height' }).fill('1.8');
  await settings.getByRole('slider', { name: 'Horizontal margin' }).fill('32');
  await settings.getByRole('slider', { name: 'Vertical margin' }).fill('20');
  await settings.getByLabel('EPUB page spread').selectOption('auto');

  const viewerFrame = page.getByTestId('epub-viewer-frame');
  await expect(viewerFrame).toHaveCSS('padding-left', '32px');
  await expect(viewerFrame).toHaveCSS('padding-top', '20px');
  await expect(viewerFrame).toHaveAttribute('data-spread', 'auto');
  await expect
    .poll(() =>
      page
        .frameLocator('iframe')
        .locator('body')
        .evaluate((body) => {
          const style = getComputedStyle(body);
          return {
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            lineHeight: style.lineHeight,
          };
        })
    )
    .toEqual({
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '24px',
      lineHeight: '43.2px',
    });

  await settings.getByLabel('EPUB reading mode').selectOption('scrolled-doc');
  await expect(viewerFrame).toHaveAttribute('data-flow', 'scrolled-doc');
  await expect(viewerFrame).toHaveCSS('padding-top', '0px');
  await expect(
    settings.getByRole('slider', { name: 'Vertical margin' })
  ).toBeDisabled();
  await expect(settings.getByLabel('EPUB page spread')).toBeDisabled();

  await page.keyboard.press('Escape');
  await expect(settings).toHaveCount(0);
  await expect(settingsButton).toBeFocused();

  const persistedSettings = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('stillpoint.epubReaderSettings'))
  );
  expect(persistedSettings).toMatchObject({
    fontFamily: 'sans',
    fontSize: 24,
    lineHeight: 1.8,
    marginHorizontal: 32,
    marginVertical: 20,
    flow: 'scrolled-doc',
    spread: 'auto',
  });
  await expect
    .poll(() => getStoredEpubSummary(page).then((record) => record?.cfi), {
      timeout: 15_000,
    })
    .toMatch(/^epubcfi\(/);

  await page.getByRole('button', { name: 'Library' }).click();
  await page.reload();
  await page.getByRole('button', { name: /^Stillpoint Test Book/ }).click();
  await expect(viewerFrame).toHaveAttribute('data-flow', 'scrolled-doc');
  await expect(viewerFrame).toHaveAttribute('data-spread', 'auto');
  await settingsButton.click();
  await expect(settings.getByLabel('EPUB font')).toHaveValue('sans');
  await expect(settings.getByRole('slider', { name: 'Font size' })).toHaveValue(
    '24'
  );
});
