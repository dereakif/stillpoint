import { expect, test } from '@playwright/test';

const SOURCE =
  '# Navigation Test\n\nzero one two three four five six seven eight nine';

const saveDocument = async (page, source = SOURCE) => {
  await page.getByPlaceholder('Paste your text here...').fill(source);
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

const applyToggle = async (page, name, checked) => {
  const dialog = await openSettings(page);
  const toggle = dialog.getByRole('checkbox', { name });
  if (checked) await toggle.check();
  else await toggle.uncheck();
  await dialog.getByRole('button', { name: 'Apply settings' }).click();
};

test('uses nearest positioning when centering the current word is disabled', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page);
  await applyToggle(page, 'Center the current word after exit', false);

  await page.evaluate(() => {
    const originalScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(options) {
      if (
        this.matches('[data-block-id="paragraph-2"][data-token-offset="2"]')
      ) {
        window.__returnScrollOptions = options;
      }
      return originalScrollIntoView.call(this, options);
    };
  });

  await page
    .locator('[data-block-id="paragraph-2"][data-token-offset="2"]')
    .click();
  await page.getByRole('button', { name: 'Exit' }).click();

  await expect
    .poll(() => page.evaluate(() => window.__returnScrollOptions?.block))
    .toBe('nearest');
});

test('remembers hint dismissal and allows the hint to be shown again', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page);

  const hint = page.getByTestId('immersive-entry-hint');
  await expect(hint).toBeVisible();
  await hint.getByRole('button', { name: 'Got it' }).click();
  await expect(hint).toHaveCount(0);

  await page.getByRole('button', { name: 'Open library' }).click();
  await page.reload();
  await page.getByRole('button', { name: /^Navigation Test/ }).click();
  await expect(hint).toHaveCount(0);

  await applyToggle(page, 'Show immersive-entry hint', true);
  await expect(hint).toBeVisible();
});

test('automatically resumes a saved document at its exact reading position', async ({
  page,
}) => {
  await page.goto('/');
  await saveDocument(page);
  await page
    .locator('[data-block-id="paragraph-2"][data-token-offset="2"]')
    .click();
  await page.getByRole('button', { name: 'Exit' }).click();

  const dialog = await openSettings(page);
  await dialog
    .getByRole('combobox', { name: 'Countdown duration' })
    .selectOption('5');
  await dialog
    .getByRole('checkbox', {
      name: 'Resume immersively when opening a document',
    })
    .check();
  await dialog.getByRole('button', { name: 'Apply settings' }).click();

  await page.getByRole('button', { name: 'Open library' }).click();
  await page.getByRole('button', { name: /^Navigation Test/ }).click();

  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toBeVisible();
  await expect(page.getByTestId('immersive-countdown')).toHaveText('5');
  await expect(page.getByTestId('current-word')).toHaveText('two');
});

test('forgets saved document scroll and reopens at the top when disabled', async ({
  page,
}) => {
  const longSource = [
    '# Scroll Memory Test',
    ...Array.from(
      { length: 45 },
      (_, index) =>
        `Paragraph ${index + 1} has enough text to create a long navigation view.`
    ),
  ].join('\n\n');

  await page.goto('/');
  await saveDocument(page, longSource);
  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(900);

  await applyToggle(page, 'Remember document scroll position', false);
  await page.getByRole('button', { name: 'Open library' }).click();
  await page.getByRole('button', { name: /^Scroll Memory Test/ }).click();

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
  const savedScrollY = await page.evaluate(
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
            resolve(recordsRequest.result[0].readingSession.navigationScrollY);
            database.close();
          };
        };
      })
  );
  expect(savedScrollY).toBe(0);
});
