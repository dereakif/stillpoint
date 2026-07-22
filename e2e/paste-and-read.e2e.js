import { expect, test } from '@playwright/test';

const CLIPBOARD_TEXT = '# Clipboard Session\n\nFocus begins here.';

test('reads clipboard text directly in immersive mode and saves it locally', async ({
  page,
}) => {
  await page.addInitScript((text) => {
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { readText: async () => text },
    });
  }, CLIPBOARD_TEXT);

  await page.goto('/');
  await page.getByRole('button', { name: 'Back' }).click();
  await page
    .locator('header')
    .getByRole('button', { name: 'Paste and read' })
    .click();

  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toBeVisible();
  await expect(page.getByPlaceholder('Paste your text here...')).toHaveCount(0);
  await expect(page.getByTestId('document-view')).toHaveCount(0);

  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const request = indexedDB.open('stillpoint-library', 1);
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const database = request.result;
                const transaction = database.transaction(
                  'documents',
                  'readonly'
                );
                const recordsRequest = transaction
                  .objectStore('documents')
                  .getAll();
                recordsRequest.onerror = () => reject(recordsRequest.error);
                recordsRequest.onsuccess = () => {
                  const record = recordsRequest.result.find(
                    (candidate) => candidate.kind === 'text'
                  );
                  resolve(
                    record
                      ? {
                          title: record.title,
                          text: record.source.text,
                        }
                      : null
                  );
                  database.close();
                };
              };
            })
        ),
      { timeout: 10_000 }
    )
    .toEqual({
      title: 'Clipboard Session',
      text: CLIPBOARD_TEXT,
    });
});
