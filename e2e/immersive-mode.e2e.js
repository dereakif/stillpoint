import { expect, test } from '@playwright/test';

const openDocument = async (page, text = 'Focus begins here.') => {
  const documentInput = page.getByPlaceholder('Paste your text here...');
  await documentInput.fill(text);
  await page.getByRole('button', { name: 'Read document' }).click();
};

const enterImmersiveMode = async (page, text = 'Focus begins here.') => {
  await openDocument(page, text);
  await page.getByRole('button', { name: 'Resume reading' }).click();
};

test('enters immersive mode with the imported document', async ({ page }) => {
  await page.goto('/');

  const documentInput = page.getByPlaceholder('Paste your text here...');
  const readButton = page.getByRole('button', { name: 'Read document' });

  await expect(readButton).toBeDisabled();
  await documentInput.fill('Focus begins here.');
  await expect(readButton).toBeEnabled();
  await readButton.click();
  await page.getByRole('button', { name: 'Resume reading' }).click();

  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Exit' })).toBeVisible();
  await expect(documentInput).not.toBeVisible();
});

test('renders document paragraphs and returns to editing', async ({ page }) => {
  await page.goto('/');
  await openDocument(page, 'First line.\nStill first!\n\nSecond paragraph?');

  const documentContent = page.getByRole('article', {
    name: 'Document content',
  });
  await expect(documentContent.locator('#paragraph-1')).toHaveText(
    'First line.\nStill first!'
  );
  await expect(documentContent.locator('#paragraph-2')).toHaveText(
    'Second paragraph?'
  );

  await page.getByRole('button', { name: 'Edit document' }).click();
  await expect(page.getByPlaceholder('Paste your text here...')).toHaveValue(
    'First line.\nStill first!\n\nSecond paragraph?'
  );
});

test('starts immersive mode from a chosen paragraph by pointer or keyboard', async ({
  page,
}) => {
  await page.goto('/');
  await openDocument(page, 'alpha beta\n\ngamma delta');

  await page.locator('#paragraph-2').evaluate((paragraph) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(paragraph);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await expect(
    page.getByRole('article', { name: 'Document content' })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await expect(page.getByTestId('current-word')).toHaveText('gamma');
  await page.keyboard.press('Escape');

  const firstParagraphAction = page.getByRole('button', {
    name: 'Immerse from paragraph 1',
  });
  await firstParagraphAction.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('current-word')).toHaveText('alpha');
});

test('exits immersive mode during the countdown', async ({ page }) => {
  await page.goto('/');
  await page.clock.install();
  await enterImmersiveMode(page);

  await expect(page.getByText('3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Exit' }).click();

  await expect(
    page.getByRole('article', { name: 'Document content' })
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toHaveCount(0);
});

test('shares reading position between document and immersive modes', async ({
  page,
}) => {
  await page.goto('/');
  await page.clock.install();
  await enterImmersiveMode(page, 'one two\n\nthree four five six');
  await page.clock.fastForward(3000);

  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('current-word')).toHaveText('six');
  await page.keyboard.press('Escape');

  const currentParagraph = page.locator('p[aria-current="location"]');
  await expect(currentParagraph).toHaveAttribute('id', 'paragraph-2');
  await expect(currentParagraph).toHaveAttribute('data-token-offset', '3');
  await expect(currentParagraph).toBeFocused();
  await expect(page.getByTestId('return-word-highlight')).toHaveText('six');

  await page.clock.fastForward(2500);
  await expect(page.getByTestId('return-word-highlight')).toHaveCount(0);
  await expect(currentParagraph).toHaveAttribute('aria-current', 'location');

  await page.getByRole('button', { name: 'Resume reading' }).click();
  await expect(page.getByTestId('current-word')).toHaveText('six');
});

test('scrolls the exact return paragraph into view', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto('/');

  const paragraphs = Array.from(
    { length: 18 },
    (_, index) => `Paragraph ${index + 1} has a few readable words.`
  ).join('\n\n');
  await openDocument(page, paragraphs);
  await page.getByRole('button', { name: 'Immerse from paragraph 14' }).click();
  await page.getByRole('button', { name: 'Exit' }).click();

  const currentParagraph = page.locator('#paragraph-14');
  await expect(currentParagraph).toBeFocused();
  await expect(page.getByTestId('return-word-highlight')).toHaveText(
    'Paragraph'
  );

  const distanceFromViewportCenter = await currentParagraph.evaluate(
    (paragraph) => {
      const bounds = paragraph.getBoundingClientRect();
      return Math.abs(bounds.top + bounds.height / 2 - window.innerHeight / 2);
    }
  );
  expect(distanceFromViewportCenter).toBeLessThan(80);
});

test('supports immersive keyboard controls', async ({ page }) => {
  await page.goto('/');
  await page.clock.install();
  await enterImmersiveMode(page, 'alpha beta gamma delta epsilon zeta');
  await page.clock.fastForward(3700);
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('Space');

  const currentWord = page.getByTestId('current-word');

  await page.keyboard.press('ArrowRight');
  await expect(currentWord).toHaveText('zeta');

  await page.keyboard.press('ArrowLeft');
  await expect(currentWord).toHaveText('alpha');

  const speedSlider = page.getByRole('slider', { name: 'Reading speed' });

  await page.keyboard.press('ArrowUp');
  await expect(speedSlider).toHaveValue('310');
  await page.keyboard.press('ArrowDown');
  await expect(speedSlider).toHaveValue('300');

  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
});

test('disables immersive transitions when reduced motion is preferred', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await enterImmersiveMode(page);

  const immersiveContent = page.getByTestId('immersive-content');
  const readingProgress = page.getByTestId('reading-progress');

  await expect(immersiveContent).toBeVisible();
  await expect(immersiveContent).toHaveCSS('transition-property', 'none');
  await expect(readingProgress).toHaveCSS('transition-property', 'none');
});

test('keeps long words inside the viewport with a centered pivot', async ({
  page,
}) => {
  const longWord = 'pneumonoultramicroscopicsilicovolcanoconiosis'.repeat(4);

  await page.goto('/');
  await enterImmersiveMode(page, longWord);

  const currentWord = page.getByTestId('current-word');
  await expect(currentWord).toHaveText(longWord);

  const metrics = await page.evaluate(() => {
    const viewport = document
      .querySelector('[data-testid="word-viewport"]')
      .getBoundingClientRect();
    const currentWordElement = document.querySelector(
      '[data-testid="current-word"]'
    );
    const pivot = document
      .querySelector('[data-testid="word-pivot"]')
      .getBoundingClientRect();
    const textRects = [...currentWordElement.children].map((element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return range.getBoundingClientRect();
    });

    return {
      viewportLeft: viewport.left,
      viewportRight: viewport.right,
      viewportCenter: viewport.left + viewport.width / 2,
      textLeft: Math.min(...textRects.map((rect) => rect.left)),
      textRight: Math.max(...textRects.map((rect) => rect.right)),
      pivotCenter: pivot.left + pivot.width / 2,
    };
  });

  expect(metrics.textLeft).toBeGreaterThanOrEqual(metrics.viewportLeft);
  expect(metrics.textRight).toBeLessThanOrEqual(metrics.viewportRight);
  expect(Math.abs(metrics.pivotCenter - metrics.viewportCenter)).toBeLessThan(
    1
  );
});

test('does not restart playback after exiting before delayed play', async ({
  page,
}) => {
  await page.goto('/');
  await page.clock.install();
  await enterImmersiveMode(page, 'alpha beta gamma delta');

  await page.clock.fastForward(3000);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.clock.fastForward(1000);

  await expect(
    page.getByRole('article', { name: 'Document content' })
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toHaveCount(0);
});
