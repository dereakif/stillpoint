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

test('previews and corrects detected Markdown structure', async ({ page }) => {
  const source = '# Opening\n\nFirst.\n\n## Details\n\nSecond.';

  await page.goto('/');
  await page.getByPlaceholder('Paste your text here...').fill(source);

  const structurePreview = page.getByRole('complementary', {
    name: 'Detected document structure',
  });
  await expect(structurePreview).toContainText('2 sections · 4 blocks');
  await expect(
    page.getByRole('textbox', { name: 'Section 1 title' })
  ).toHaveValue('Opening');

  await page
    .getByRole('textbox', { name: 'Section 2 title' })
    .fill('Revised details');
  await expect(page.getByPlaceholder('Paste your text here...')).toHaveValue(
    '# Opening\n\nFirst.\n\n## Revised details\n\nSecond.'
  );

  await page.getByRole('button', { name: 'Start section at Second.' }).click();
  await expect(structurePreview).toContainText('3 sections · 5 blocks');
  await expect(
    page.getByRole('textbox', { name: 'Section 3 title' })
  ).toHaveValue('New section');
});

test('preserves source while exposing structured block metadata', async ({
  page,
}) => {
  const source =
    '# Introduction\n\nA paragraph.\n\n> A quote.\n\n- First\n- Second\n\n---';

  await page.goto('/');
  await openDocument(page, source);

  await expect(page.locator('#paragraph-1')).toHaveAttribute(
    'data-block-type',
    'heading'
  );
  await expect(page.locator('#paragraph-2')).toHaveAttribute(
    'data-block-type',
    'paragraph'
  );
  await expect(page.locator('#paragraph-3')).toHaveAttribute(
    'data-block-type',
    'quote'
  );
  await expect(page.locator('#paragraph-4')).toHaveAttribute(
    'data-block-type',
    'list'
  );
  await expect(page.locator('#paragraph-5')).toHaveAttribute(
    'data-block-type',
    'separator'
  );
  await expect(page.locator('#paragraph-1')).toHaveAttribute(
    'data-section-id',
    'section-1'
  );

  await page.getByRole('button', { name: 'Edit document' }).click();
  await expect(page.getByPlaceholder('Paste your text here...')).toHaveValue(
    source
  );
});

test('starts after a structured heading without reading Markdown markers', async ({
  page,
}) => {
  await page.goto('/');
  await openDocument(page, '# Introduction\n\nFirst readable paragraph.');

  const heading = page.locator('#paragraph-1');
  await expect(heading).toHaveText('Introduction');
  await heading.click();
  await expect(page.getByTestId('current-word')).toHaveText('First');
});

test('starts immersive reading from an exact clicked word', async ({
  page,
}) => {
  await page.goto('/');
  await openDocument(page, 'alpha beta gamma');

  const beta = page.locator(
    '[data-block-id="paragraph-1"][data-token-offset="1"]'
  );
  await expect(beta).toHaveText('beta');
  await beta.click();

  await expect(page.getByTestId('current-word')).toHaveText('beta');
});

test('starts a paragraph from its first token when its reading surface is activated', async ({
  page,
}) => {
  await page.goto('/');
  await openDocument(page, 'alpha beta gamma');

  await page.locator('#paragraph-1').evaluate((paragraph) => {
    paragraph.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  await expect(page.getByTestId('current-word')).toHaveText('alpha');
});

test('uses one roving keyboard target for exact-word entry', async ({
  page,
}) => {
  await page.goto('/');
  await openDocument(page, 'alpha beta gamma');

  const alpha = page.locator(
    '[data-block-id="paragraph-1"][data-token-offset="0"]'
  );
  const beta = page.locator(
    '[data-block-id="paragraph-1"][data-token-offset="1"]'
  );
  await expect(alpha).toHaveAttribute('tabindex', '0');
  await expect(beta).toHaveAttribute('tabindex', '-1');

  await alpha.focus();
  await page.keyboard.press('ArrowRight');
  await expect(beta).toBeFocused();
  await expect(beta).toHaveAttribute('tabindex', '0');
  await expect(alpha).toHaveAttribute('tabindex', '-1');

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('current-word')).toHaveText('beta');
});

test('does not enter immersive mode while document text is selected', async ({
  page,
}) => {
  await page.goto('/');
  await openDocument(page, 'alpha beta gamma');

  const beta = page.locator(
    '[data-block-id="paragraph-1"][data-token-offset="1"]'
  );
  await beta.evaluate((word) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(word);
    selection.removeAllRanges();
    selection.addRange(range);
    word.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });

  await expect(
    page.getByRole('article', { name: 'Document content' })
  ).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toHaveCount(0);
});

test('presents a centered document workspace with desktop contents navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await openDocument(
    page,
    '# Introduction\n\nWelcome to the document.\n\n## Basics\n\nLearn the essentials.\n\n## Summary\n\nReview the ideas.'
  );

  await expect(page.getByTestId('document-top-bar')).toContainText(
    'Introduction'
  );
  const desktopContents = page.getByTestId('desktop-table-of-contents');
  await expect(desktopContents).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Contents', exact: true })
  ).toBeHidden();
  await expect(page.getByTestId('document-status-bar')).toHaveCSS(
    'position',
    'fixed'
  );

  const articleWidth = await page
    .getByRole('article', { name: 'Document content' })
    .evaluate((article) => article.getBoundingClientRect().width);
  expect(articleWidth).toBeLessThanOrEqual(768);

  const collapseButton = page.getByRole('button', {
    name: 'Collapse contents',
  });
  const expandedWidth = await desktopContents.evaluate(
    (contents) => contents.getBoundingClientRect().width
  );
  await collapseButton.click();
  await expect(
    page.getByRole('button', { name: 'Expand contents' })
  ).toBeVisible();
  await page.waitForTimeout(350);
  const collapsedWidth = await desktopContents.evaluate(
    (contents) => contents.getBoundingClientRect().width
  );
  expect(collapsedWidth).toBeLessThan(expandedWidth);
});

test('navigates and immerses by chapter from the table of contents', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  await page.goto('/');
  await openDocument(
    page,
    '# Introduction\n\nWelcome to the document.\n\n## Basics\n\nLearn the essentials.'
  );

  const contents = page.getByRole('navigation', {
    name: 'Table of contents',
  });
  const basicsLink = contents.getByRole('button', {
    name: 'Basics',
    exact: true,
  });
  await basicsLink.click();

  await expect(page).toHaveURL(/#section-2$/);
  await expect(basicsLink).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('#paragraph-3')).toBeFocused();
  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toHaveCount(0);

  await contents.getByRole('button', { name: 'Immerse Basics' }).click();
  await expect(page.getByTestId('current-word')).toHaveText('Learn');
});

test('pauses at a chapter boundary and shows the next chapter before continuing', async ({
  page,
}) => {
  await page.goto('/');
  await page.clock.install();
  await openDocument(page, '# One\n\nalpha\n\n# Two\n\nbeta');

  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await expect(page.getByTestId('current-word')).toHaveText('alpha');
  await expect(page.getByTestId('reading-progress')).toHaveAttribute(
    'style',
    /width: 50%/
  );
  await expect(page.getByTestId('chapter-progress')).toHaveAttribute(
    'style',
    /width: 100%/
  );
  await expect(page.getByTestId('chapter-progress-status')).toContainText(
    'One · 100%'
  );

  await page.clock.fastForward(4500);

  const boundaryDialog = page.getByRole('dialog', { name: 'Chapter complete' });
  await expect(boundaryDialog).toBeVisible();
  await expect(boundaryDialog).toContainText('One');
  await expect(page.getByTestId('chapter-session-summary')).toHaveText(
    '1 word read in this chapter'
  );
  await expect(page.getByTestId('next-chapter-title')).toHaveText('Two');
  const continueButton = page.getByRole('button', {
    name: 'Continue to next chapter',
  });
  await expect(continueButton).toBeFocused();
  await expect(page.getByRole('button', { name: 'Play' })).toHaveCount(0);

  await continueButton.click();
  await expect(boundaryDialog).toHaveCount(0);
  await expect(page.getByTestId('current-word')).toHaveText('Two');
  await expect(page.getByTestId('chapter-progress-status')).toContainText(
    'Two · 50%'
  );
  await expect(page.getByTestId('chapter-progress')).toHaveAttribute(
    'style',
    /width: 50%/
  );
});

test('returns to the completed chapter position from a boundary', async ({
  page,
}) => {
  await page.goto('/');
  await page.clock.install();
  await openDocument(page, '# One\n\nalpha\n\n# Two\n\nbeta');
  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await page.clock.fastForward(4500);
  await expect(
    page.getByRole('dialog', { name: 'Chapter complete' })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Return to document' }).click();
  const returnToken = page.getByTestId('return-word-highlight');
  await expect(returnToken).toHaveText('alpha');
  await expect(page.locator('#paragraph-2')).toHaveAttribute(
    'data-position-marker',
    'current-block'
  );
});

test('reviews a completed chapter from its first readable word', async ({
  page,
}) => {
  await page.goto('/');
  await page.clock.install();
  await openDocument(page, '# One\n\nalpha\n\n# Two\n\nbeta');
  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await page.clock.fastForward(4500);
  const boundaryDialog = page.getByRole('dialog', { name: 'Chapter complete' });
  await expect(boundaryDialog).toBeVisible();

  await page.getByRole('button', { name: 'Review chapter' }).click();

  await expect(boundaryDialog).toHaveCount(0);
  await expect(page.getByText('3', { exact: true })).toBeVisible();
  await expect(page.getByTestId('current-word')).toHaveText('alpha');

  await page.getByRole('button', { name: 'Exit' }).click();
  await expect(page.getByTestId('return-word-highlight')).toHaveText('alpha');
});

test('supports keyboard selection for every chapter-complete choice', async ({
  page,
}) => {
  await page.goto('/');
  await page.clock.install();
  await openDocument(page, '# One\n\nalpha\n\n# Two\n\nbeta');
  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await page.clock.fastForward(4500);

  const continueButton = page.getByRole('button', {
    name: 'Continue to next chapter',
  });
  await expect(continueButton).toBeFocused();
  await expect(
    page.getByRole('combobox', { name: 'Chapter completion behavior' })
  ).toHaveValue('ask');
  await page.keyboard.press('Shift+Tab');
  const returnButton = page.getByRole('button', { name: 'Return to document' });
  await expect(returnButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(
    page.getByRole('button', { name: 'Review chapter' })
  ).toBeFocused();
});

test('cancels automatic chapter continuation back to the Ask prompt', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'stillpoint.chapterCompletionBehavior',
      'continue'
    );
  });
  await page.goto('/');
  await page.clock.install();
  await openDocument(page, '# One\n\nalpha\n\n# Two\n\nbeta');
  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await page.clock.fastForward(4500);

  const automaticDialog = page.getByRole('dialog', {
    name: 'Continuing to next chapter',
  });
  await expect(automaticDialog).toBeVisible();
  await expect(page.getByTestId('automatic-next-chapter-title')).toHaveText(
    'Two'
  );
  await expect(page.getByTestId('automatic-continue-countdown')).toHaveText(
    '3'
  );
  await page.clock.fastForward(2000);
  await expect(page.getByTestId('automatic-continue-countdown')).toHaveText(
    '1'
  );

  await page
    .getByRole('button', { name: 'Cancel automatic continuation' })
    .click();
  await expect(automaticDialog).toHaveCount(0);
  await expect(
    page.getByRole('dialog', { name: 'Chapter complete' })
  ).toBeVisible();
  await page.clock.fastForward(5000);
  await expect(page.getByTestId('current-word')).toHaveText('alpha');
});

test('continues automatically after the cancelable countdown', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'stillpoint.chapterCompletionBehavior',
      'continue'
    );
  });
  await page.goto('/');
  await page.clock.install();
  await openDocument(page, '# One\n\nalpha\n\n# Two\n\nbeta');
  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await page.clock.fastForward(4500);
  await expect(
    page.getByRole('dialog', { name: 'Continuing to next chapter' })
  ).toBeVisible();

  await page.clock.fastForward(3000);
  await expect(
    page.getByRole('dialog', { name: 'Continuing to next chapter' })
  ).toHaveCount(0);
  await expect(page.getByTestId('current-word')).toHaveText('Two');
});

test('returns to the document automatically at a chapter boundary', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'stillpoint.chapterCompletionBehavior',
      'return'
    );
  });
  await page.goto('/');
  await page.clock.install();
  await openDocument(page, '# One\n\nalpha\n\n# Two\n\nbeta');
  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await page.clock.fastForward(4500);

  await expect(
    page.getByRole('article', { name: 'Document content' })
  ).toBeVisible();
  await expect(page.getByTestId('return-word-highlight')).toHaveText('alpha');
  await expect(
    page.getByRole('dialog', { name: 'Chapter complete' })
  ).toHaveCount(0);
});

test('persists the selected chapter completion behavior', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  const source = '# One\n\nalpha\n\n# Two\n\nbeta';
  await openDocument(page, source);

  const behaviorSelect = page.getByRole('combobox', {
    name: 'Chapter completion behavior',
  });
  await expect(behaviorSelect).toHaveValue('ask');
  await behaviorSelect.selectOption('continue');
  await expect(behaviorSelect).toHaveValue('continue');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible();
  await page.getByRole('button', { name: /^One/ }).click();
  await expect(
    page.getByRole('combobox', { name: 'Chapter completion behavior' })
  ).toHaveValue('continue');
});

test('uses an accessible contents drawer on tablet and mobile widths', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 800 });
  await page.goto('/');
  await openDocument(
    page,
    '# Introduction\n\nWelcome.\n\n## Basics\n\nLearn more.'
  );

  const contentsButton = page.getByRole('button', { name: 'Contents' });
  await expect(contentsButton).toBeVisible();
  await expect(page.getByTestId('desktop-table-of-contents')).toBeHidden();

  await contentsButton.click();
  const drawer = page.getByRole('dialog', { name: 'Document contents' });
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole('button', { name: 'Close contents' })
  ).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  await expect(contentsButton).toBeFocused();

  await contentsButton.click();
  await drawer.getByRole('button', { name: 'Basics', exact: true }).click();
  await expect(drawer).toHaveCount(0);
  await expect(page).toHaveURL(/#section-2$/);
  await expect(page.locator('#paragraph-3')).toBeFocused();
});

test('teaches immersive entry and dims the hint after a short delay', async ({
  page,
}) => {
  await page.clock.install();
  await page.goto('/');
  await openDocument(page, 'alpha beta gamma');

  const hint = page.getByTestId('immersive-entry-hint');
  await expect(hint).toContainText(
    'Click any word, heading, or paragraph to Immerse'
  );
  await expect(hint).toHaveCSS('opacity', '0.8');

  await page.clock.fastForward(3500);
  await expect(hint).toHaveCSS('opacity', '0.45');
});

test('keeps the entry hint static when reduced motion is preferred', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install();
  await page.goto('/');
  await openDocument(page, 'alpha beta gamma');

  const hint = page.getByTestId('immersive-entry-hint');
  await expect(hint).toHaveCSS('transition-property', 'none');
  await page.clock.fastForward(5000);
  await expect(hint).toHaveCSS('opacity', '0.8');
});

test('hides the entry hint for the session after immersive mode starts', async ({
  page,
}) => {
  await page.goto('/');
  await openDocument(page, 'alpha beta gamma');
  await expect(page.getByTestId('immersive-entry-hint')).toBeVisible();

  await page
    .locator('[data-block-id="paragraph-1"][data-token-offset="1"]')
    .click();
  await expect(page.getByTestId('immersive-entry-hint')).toHaveCount(0);

  await page.getByRole('button', { name: 'Exit' }).click();
  await expect(
    page.getByRole('article', { name: 'Document content' })
  ).toBeVisible();
  await expect(page.getByTestId('immersive-entry-hint')).toHaveCount(0);
});

test('shows synchronized navigation progress and resume context', async ({
  page,
}) => {
  await page.goto('/');
  await page.clock.install();
  await openDocument(page, 'one two\n\nthree four five');

  await expect(page.getByTestId('current-position-status')).toHaveText(
    'Paragraph 1 of 2 · Word 1 of 2'
  );
  await expect(page.getByTestId('document-progress-value')).toHaveText('20%');
  await expect(
    page.getByRole('progressbar', { name: 'Document progress' })
  ).toHaveAttribute('value', '20');
  await expect(
    page.getByRole('button', { name: /Resume reading Paragraph 1 · 20%/ })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await page.clock.fastForward(3000);
  await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Escape');

  await expect(page.getByTestId('current-position-status')).toHaveText(
    'Paragraph 2 of 2 · Word 3 of 3'
  );
  await expect(page.getByTestId('document-progress-value')).toHaveText('100%');
  await expect(
    page.getByRole('button', { name: /Resume reading Paragraph 2 · 100%/ })
  ).toBeVisible();
});

test('keeps navigation controls usable at a 400% zoom reflow width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  await openDocument(page, 'Readable content remains available at high zoom.');

  const contentsButton = page.getByRole('button', { name: 'Contents' });
  const editButton = page.getByRole('button', { name: 'Edit document' });
  const resumeButton = page.getByRole('button', { name: /Resume reading/ });
  await expect(contentsButton).toBeVisible();
  await expect(editButton).toBeVisible();
  await expect(resumeButton).toBeVisible();

  await contentsButton.focus();
  await expect(contentsButton).toBeFocused();
  await editButton.focus();
  await expect(editButton).toBeFocused();
  await resumeButton.focus();
  await expect(resumeButton).toBeFocused();

  const layout = await page.evaluate(() => {
    const status = document
      .querySelector('[data-testid="document-status-bar"]')
      .getBoundingClientRect();

    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      statusLeft: status.left,
      statusRight: status.right,
      statusBottom: status.bottom,
      viewportHeight: window.innerHeight,
    };
  });
  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.statusLeft).toBeGreaterThanOrEqual(0);
  expect(layout.statusRight).toBeLessThanOrEqual(layout.clientWidth);
  expect(layout.statusBottom).toBeLessThanOrEqual(layout.viewportHeight);
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

test('connects the selected paragraph through entry and return transitions', async ({
  page,
}) => {
  await page.goto('/');
  await page.clock.install();
  await openDocument(page, 'alpha beta\n\ngamma delta epsilon zeta');

  await page.getByRole('button', { name: 'Immerse from paragraph 2' }).click();
  await page.clock.fastForward(900);

  const documentView = page.getByTestId('document-view');
  const immersiveMode = page.locator(
    'section[aria-label="Immersive reading mode"]'
  );
  const selectedParagraphContainer = page.locator('#paragraph-2').locator('..');
  const surroundingParagraphContainer = page
    .locator('#paragraph-1')
    .locator('..');

  await expect(documentView).toHaveAttribute('aria-hidden', 'true');
  await expect(immersiveMode).toHaveAttribute(
    'data-transition-state',
    'entered'
  );
  await expect(immersiveMode).toHaveCSS('transition-duration', '0.8s');
  await expect(selectedParagraphContainer).toHaveCSS('opacity', '0.7');
  await expect(surroundingParagraphContainer).toHaveCSS('opacity', '0.1');

  await page.keyboard.press('Escape');
  await expect(immersiveMode).toHaveAttribute(
    'data-transition-state',
    'exiting'
  );
  await expect(documentView).toHaveAttribute('aria-hidden', 'false');

  const currentParagraph = page.locator('#paragraph-2');
  const currentToken = page.getByTestId('return-word-highlight');
  await expect(currentToken).toBeFocused();
  await expect(currentParagraph).toHaveAttribute('data-token-offset', '0');

  await page.keyboard.press('ArrowRight');
  await expect(currentParagraph).toHaveAttribute('data-token-offset', '0');

  await page.clock.fastForward(800);
  await expect(immersiveMode).toHaveCount(0);
  await expect(selectedParagraphContainer).toHaveCSS('opacity', '1');
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
  await expect(currentParagraph).toHaveAttribute(
    'data-position-marker',
    'current-block'
  );

  const returnToken = page.getByTestId('return-word-highlight');
  await expect(returnToken).toHaveText('six');
  await expect(returnToken).toBeFocused();
  await expect(returnToken).toHaveAttribute(
    'data-highlight-kind',
    'return-position'
  );
  await expect(returnToken).toHaveCSS('animation-duration', '1.1s');

  await page.clock.fastForward(1200);
  await expect(page.getByTestId('return-word-highlight')).toHaveCount(0);
  await expect(currentParagraph).toHaveAttribute('aria-current', 'location');
  await expect(currentParagraph).toHaveAttribute(
    'data-position-marker',
    'current-block'
  );

  await page.getByRole('button', { name: 'Resume reading' }).click();
  await expect(page.getByTestId('current-word')).toHaveText('six');
});

test('centers the exact return token while retaining its block marker', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 600 });
  await page.goto('/');

  const paragraphs = Array.from(
    { length: 18 },
    (_, index) => `Paragraph ${index + 1} has a few readable words.`
  ).join('\n\n');
  await openDocument(page, paragraphs);
  await page
    .locator('[data-block-id="paragraph-14"][data-token-offset="4"]')
    .click();
  await page.getByRole('button', { name: 'Exit' }).click();

  const currentParagraph = page.locator('#paragraph-14');
  const currentToken = page.getByTestId('return-word-highlight');
  await expect(currentToken).toHaveText('few');
  await expect(currentToken).toBeFocused();
  await expect(currentParagraph).toHaveAttribute(
    'data-position-marker',
    'current-block'
  );

  const distanceFromViewportCenter = await currentToken.evaluate((token) => {
    const bounds = token.getBoundingClientRect();
    return Math.abs(bounds.top + bounds.height / 2 - window.innerHeight / 2);
  });
  expect(distanceFromViewportCenter).toBeLessThan(80);
});

test('keeps an exact static return indication with reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await openDocument(page, 'alpha beta gamma');
  await page
    .locator('[data-block-id="paragraph-1"][data-token-offset="1"]')
    .click();
  await page.getByRole('button', { name: 'Exit' }).click();

  const returnToken = page.getByTestId('return-word-highlight');
  await expect(returnToken).toHaveText('beta');
  await expect(returnToken).toHaveCSS('animation-name', 'none');
  await expect(returnToken).toHaveAttribute(
    'data-highlight-kind',
    'return-position'
  );
  await expect(page.locator('#paragraph-1')).toHaveAttribute(
    'data-position-marker',
    'current-block'
  );
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

test('peeks at sentence context while paused without moving the reading position', async ({
  page,
}) => {
  await page.goto('/');
  await page.clock.install();
  await openDocument(
    page,
    'Echo ends the first sentence. Echo stays highlighted in this sentence.'
  );
  await page
    .locator('[data-block-id="paragraph-1"][data-token-offset="5"]')
    .click();
  await page.clock.fastForward(3700);

  const currentWord = page.getByTestId('current-word');
  await expect(currentWord).toHaveText('Echo');
  await expect(page.getByRole('button', { name: 'Context' })).toHaveCount(0);
  await page.keyboard.press('Space');

  const contextButton = page.getByRole('button', { name: 'Context' });
  await expect(contextButton).toBeVisible();
  await contextButton.click();
  const contextPeek = page.getByRole('region', { name: 'Sentence context' });
  await expect(contextPeek).toContainText(
    'Echo stays highlighted in this sentence.'
  );
  await expect(page.getByTestId('context-current-word')).toHaveText('Echo');
  await expect(currentWord).toHaveText('Echo');

  await page.getByRole('button', { name: 'Play' }).click();
  await expect(contextPeek).toHaveCount(0);
  await expect(currentWord).toHaveText('Echo');
  await page.getByRole('button', { name: 'Pause' }).click();

  const immersiveMode = page.getByRole('region', {
    name: 'Immersive reading mode',
  });
  await immersiveMode.focus();
  await page.keyboard.down('c');
  await expect(contextPeek).toBeVisible();
  await expect(contextPeek).toContainText('Release C to return');
  await page.keyboard.up('c');
  await expect(contextPeek).toHaveCount(0);
  await expect(currentWord).toHaveText('Echo');
});

test('closes a toggled context peek before Escape exits immersive mode', async ({
  page,
}) => {
  await page.goto('/');
  await page.clock.install();
  await enterImmersiveMode(page, 'One complete sentence. Another follows.');
  await page.clock.fastForward(3700);
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Context' }).click();

  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('region', { name: 'Sentence context' })
  ).toHaveCount(0);
  await expect(
    page.getByRole('region', { name: 'Immersive reading mode' })
  ).toBeVisible();
});

test('disables immersive transitions when reduced motion is preferred', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await enterImmersiveMode(page);

  const immersiveContent = page.getByTestId('immersive-content');
  const readingProgress = page.getByTestId('reading-progress');

  const immersiveMode = page.locator(
    'section[aria-label="Immersive reading mode"]'
  );
  const documentHeader = page.getByTestId('document-view').locator('header');

  await expect(immersiveContent).toBeVisible();
  await expect(immersiveMode).toHaveCSS('transition-property', 'opacity');
  await expect(immersiveContent).toHaveCSS('transition-property', 'opacity');
  await expect(documentHeader).toHaveCSS('transition-property', 'opacity');
  await expect(immersiveContent).toHaveCSS('filter', 'none');
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
