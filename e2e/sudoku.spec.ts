import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * A fixed board with 12 empty cells, each solvable as a naked single, so
 * the autofill cascade can complete it unaided. Handy facts about it:
 * cell 0 is empty and its only candidate is 1; cell 1 is empty with only
 * candidate 6; cell 2 is a given 2 in the same row; the digit 5 already
 * appears nine times.
 */
const SINGLES =
  '002845379457090826938607015583902164694310752701456983075280041246731598819564237';

function cells(page: Page): Locator {
  return page.locator('sudoku-board .cell');
}

function fillCount(page: Page): Locator {
  return page.locator('.status span').nth(1);
}

function toggle(page: Page, label: string): Locator {
  return page.locator('.actions .btn', { hasText: label });
}

test('loads the board from the s query parameter', async ({ page }) => {
  await page.goto(`/?s=${SINGLES}`);
  await expect(cells(page)).toHaveCount(81);
  await expect(fillCount(page)).toHaveText('69 / 81');
  await expect(cells(page).nth(0)).toHaveText('');
  await expect(cells(page).nth(2)).toHaveText('2');
  await expect(cells(page).nth(2)).toHaveClass(/given/);
});

test('a malformed s parameter falls back to a generated puzzle', async ({
  page,
}) => {
  await page.goto('/?s=123');
  await expect(cells(page)).toHaveCount(81);
  // The bad parameter is dropped from the URL.
  await expect(page).toHaveURL('/');
});

test('enters and erases numbers with the keyboard', async ({ page }) => {
  await page.goto(`/?s=${SINGLES}`);
  await cells(page).nth(0).click();
  await page.keyboard.press('1');
  await expect(cells(page).nth(0)).toHaveText('1');
  await expect(fillCount(page)).toHaveText('70 / 81');
  await page.keyboard.press('Backspace');
  await expect(cells(page).nth(0)).toHaveText('');
  // Arrows move the selection: cell 1's value goes in without clicking it.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('6');
  await expect(cells(page).nth(1)).toHaveText('6');
});

test('enters numbers with the number pad', async ({ page }) => {
  await page.goto(`/?s=${SINGLES}`);
  await cells(page).nth(0).click();
  await page.locator('.pad button', { hasText: '1' }).click();
  await expect(cells(page).nth(0)).toHaveText('1');
});

test('given cells cannot be changed', async ({ page }) => {
  await page.goto(`/?s=${SINGLES}`);
  await cells(page).nth(2).click();
  await page.keyboard.press('9');
  await expect(cells(page).nth(2)).toHaveText('2');
  await page.keyboard.press('Backspace');
  await expect(cells(page).nth(2)).toHaveText('2');
});

test('highlights conflicting entries until they are erased', async ({
  page,
}) => {
  await page.goto(`/?s=${SINGLES}`);
  await cells(page).nth(0).click();
  await page.keyboard.press('2'); // duplicates the given 2 in the same row
  await expect(cells(page).nth(0)).toHaveClass(/conflict/);
  await expect(cells(page).nth(2)).toHaveClass(/conflict/);
  await page.keyboard.press('Backspace');
  await expect(cells(page).nth(0)).not.toHaveClass(/conflict/);
  await expect(cells(page).nth(2)).not.toHaveClass(/conflict/);
});

test('the number pad disables completed digits', async ({ page }) => {
  await page.goto(`/?s=${SINGLES}`);
  await expect(page.locator('.pad button', { hasText: '5' })).toBeDisabled();
  await expect(page.locator('.pad button', { hasText: '4' })).toBeEnabled();
});

test('candidates mode toggles manual pencil marks', async ({ page }) => {
  await page.goto(`/?s=${SINGLES}`);
  await cells(page).nth(0).click();
  await page.keyboard.press('c');
  await expect(toggle(page, 'Candidates')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.keyboard.press('3');
  await page.keyboard.press('7');
  const marks = cells(page).nth(0).locator('.candidates');
  await expect(marks).toContainText('3');
  await expect(marks).toContainText('7');
  await page.keyboard.press('3');
  await expect(marks).not.toContainText('3');
  await expect(marks).toContainText('7');
});

test('auto candidates derive from the board and honor manual removals', async ({
  page,
}) => {
  await page.goto(`/?s=${SINGLES}`);
  await page.keyboard.press('a');
  await expect(toggle(page, 'Auto')).toHaveAttribute('aria-pressed', 'true');
  const marks = cells(page).nth(0).locator('.candidates');
  await expect(marks).toHaveText('1');

  // Derived marks follow entries and erases.
  await cells(page).nth(0).click();
  await page.keyboard.press('1');
  await expect(marks).toHaveCount(0);
  await page.keyboard.press('Backspace');
  await expect(marks).toHaveText('1');

  // A mark removed by hand stays removed.
  await page.keyboard.press('c');
  await page.keyboard.press('1');
  await expect(marks).toHaveCount(0);
});

test('autofill singles cascades to a win with celebration', async ({
  page,
}) => {
  await page.goto(`/?s=${SINGLES}`);
  await page.keyboard.press('f');
  await expect(toggle(page, 'Fill')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.overlay h2')).toHaveText('Solved!', {
    timeout: 15_000,
  });
  await expect(fillCount(page)).toHaveText('81 / 81');
  await expect(page.locator('sudoku-board .cell.autofilled')).toHaveCount(12);
  await expect(page.locator('.overlay canvas.confetti')).toBeVisible();
});

test('bonkers mode ejects an overwritten digit', async ({ page }) => {
  await page.goto(`/?s=${SINGLES}`);
  await page.keyboard.press('b');
  await expect(toggle(page, 'Bonkers')).toHaveAttribute('aria-pressed', 'true');
  await cells(page).nth(0).click();
  await page.keyboard.press('1');
  await page.keyboard.press('2');
  // The old digit is launched as a floating element on the body...
  const ejected = page.locator('body > div');
  await expect(ejected).toHaveText('1');
  // ...and cleaned up once it tumbles off screen.
  await expect(ejected).toHaveCount(0, { timeout: 5_000 });
  await expect(cells(page).nth(0)).toHaveText('2');
});

test('starting a new game clears the s parameter', async ({ page }) => {
  await page.goto(`/?s=${SINGLES}`);
  await page.getByRole('button', { name: 'New game' }).click();
  await expect(page).toHaveURL('/');
  await expect(cells(page)).toHaveCount(81);
});
