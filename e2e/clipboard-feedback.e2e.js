import { expect, test } from '@playwright/test';

const ORIGINAL_TEXT = 'original document words stay safe';

const configureClipboard = async (
  page,
  { text = 'replacement clipboard words', errorName = null, secure = true }
) => {
  await page.addInitScript(
    ({ clipboardText, clipboardErrorName, secureContext }) => {
      Object.defineProperty(window, 'isSecureContext', {
        configurable: true,
        value: secureContext,
      });
      Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: {
          readText: async () => {
            if (clipboardErrorName) {
              throw new DOMException(
                'Clipboard read blocked',
                clipboardErrorName
              );
            }
            return clipboardText;
          },
        },
      });
    },
    {
      clipboardText: text,
      clipboardErrorName: errorName,
      secureContext: secure,
    }
  );
};

const openEditorWithText = async (page, text = ORIGINAL_TEXT) => {
  await page.goto('/');
  await page.getByPlaceholder('Paste your text here...').fill(text);
};

const pasteFromClipboard = (page) =>
  page.getByRole('button', { name: 'Paste from clipboard' }).click();

test('shows specific feedback when clipboard permission is denied', async ({
  page,
}) => {
  await configureClipboard(page, { errorName: 'NotAllowedError' });
  await openEditorWithText(page);

  await pasteFromClipboard(page);
  const feedback = page.getByRole('alert');
  await expect(feedback).toContainText('Clipboard permission was denied');
  await expect(feedback).toContainText('document editor');
  await expect(page.getByPlaceholder('Paste your text here...')).toHaveValue(
    ORIGINAL_TEXT
  );
});

test('reports an empty clipboard without replacing editor text', async ({
  page,
}) => {
  await configureClipboard(page, { text: '  \n  ' });
  await openEditorWithText(page);

  await pasteFromClipboard(page);
  await expect(page.getByRole('alert')).toContainText('clipboard is empty');
  await expect(page.getByPlaceholder('Paste your text here...')).toHaveValue(
    ORIGINAL_TEXT
  );
});

test('explains secure-context requirements beside the editor', async ({
  page,
}) => {
  await configureClipboard(page, { secure: false });
  await openEditorWithText(page);

  await pasteFromClipboard(page);
  const feedback = page.getByRole('alert');
  await expect(feedback).toContainText('secure connection');
  await expect(feedback).toContainText('HTTPS or on localhost');
  await feedback
    .getByRole('button', { name: 'Dismiss clipboard message' })
    .click();
  await expect(feedback).toHaveCount(0);
});

test('puts valid clipboard text in an empty editor for review', async ({
  page,
}) => {
  const replacement = '# Clipboard replacement\n\nnew readable words';
  await configureClipboard(page, { text: replacement });
  await openEditorWithText(page, '');

  await pasteFromClipboard(page);
  await expect(page.getByTestId('clipboard-feedback')).toContainText(
    'ready to review'
  );
  await expect(page.getByPlaceholder('Paste your text here...')).toHaveValue(
    replacement
  );
  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Read document' })
  ).toBeVisible();
});

test('asks before replacing existing editor text and does not start reading', async ({
  page,
}) => {
  const replacement = '# Confirmed replacement\n\nreview this text first';
  await configureClipboard(page, { text: replacement });
  await openEditorWithText(page);

  await pasteFromClipboard(page);
  const dialog = page.getByRole('alertdialog', {
    name: 'Replace editor text?',
  });
  await expect(dialog).toBeVisible();
  await expect(page.getByPlaceholder('Paste your text here...')).toHaveValue(
    ORIGINAL_TEXT
  );

  await dialog.getByRole('button', { name: 'Keep current text' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByPlaceholder('Paste your text here...')).toHaveValue(
    ORIGINAL_TEXT
  );

  await pasteFromClipboard(page);
  await dialog.getByRole('button', { name: 'Replace text' }).click();
  await expect(page.getByPlaceholder('Paste your text here...')).toHaveValue(
    replacement
  );
  await expect(page.getByTestId('clipboard-feedback')).toContainText(
    'ready to review'
  );
  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toHaveCount(0);
});
