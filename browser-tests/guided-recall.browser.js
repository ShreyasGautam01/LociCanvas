/* global process */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const HOST = 'http://127.0.0.1:4173';
const BASE_PATH = process.env.GITHUB_ACTIONS === 'true' ? '/LociCanvas/' : '/';
const APP_URL = HOST + BASE_PATH;

async function waitForServer(server, url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error('Vite preview exited before becoming ready.');
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Preview is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Vite preview did not become ready at ' + url);
}

async function addRouteStep(page, optionPattern) {
  await page.getByRole('combobox', { name: 'Add existing marker' }).click();
  await page.getByRole('option', { name: optionPattern }).click();
  await page.getByRole('button', { name: 'Add step' }).click();
}

test('create a gateway-connected recall route, persist it, and export it in a backup', async () => {
  const server = spawn(process.execPath, [
    './node_modules/vite/bin/vite.js',
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4173',
    '--strictPort',
  ], { stdio: 'ignore' });

  let browser;
  try {
    await waitForServer(server, APP_URL);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(APP_URL);
    await page.getByRole('button', { name: 'Explore the sample' }).click();
    await page.getByRole('button', { name: 'Guided Recall routes' }).click();
    const managerHeading = page.getByRole('heading', { name: 'Guided Recall routes' });
    await managerHeading.waitFor();
    assert.equal(
      await managerHeading.evaluate((element) => element === document.activeElement),
      true,
      'Opening Guided Recall should move focus to its heading.',
    );

    const createRouteButton = page.getByRole('button', { name: 'Create route' });
    await createRouteButton.focus();
    await page.keyboard.press('Enter');
    const routeNameField = page.getByRole('textbox', { name: 'Route name' });
    await routeNameField.waitFor();
    assert.equal(
      await routeNameField.evaluate((element) => element === document.activeElement),
      true,
      'Opening the route editor should focus the route-name field.',
    );
    await routeNameField.fill('Browser integration route');
    await addRouteStep(page, /Recall · The Grand Library \/ Philosophy of Loci/);
    await addRouteStep(page, /Gateway · The Grand Library/);
    await addRouteStep(page, /Recall · The Oak Desk \/ Draft Paper/);

    await page.getByRole('button', { name: 'Save route' }).click();
    await page.getByText('2 recall stops · 1 gateways').waitFor();
    assert.equal(await page.getByText('Browser integration route').count() > 0, true);

    // Start the runner and verify focus, accessible answer hiding, mobile layout and keyboard operation.
    await page.getByRole('button', { name: 'Start recall' }).click();
    const firstCue = page.getByRole('heading', { name: 'Philosophy of Loci', exact: true });
    await firstCue.waitFor();
    assert.equal(
      await firstCue.evaluate((element) => element === document.activeElement),
      true,
      'Starting a recall step should focus the cue heading.',
    );
    const answerText = 'The method of loci is a strategy for memory enhancement';
    assert.equal(await page.getByText(answerText, { exact: false }).count(), 0);
    const answerInAccessibleLabels = await page.locator('[aria-label], [aria-description], [title]').evaluateAll(
      (elements) => elements.some((element) => [
        element.getAttribute('aria-label'),
        element.getAttribute('aria-description'),
        element.getAttribute('title'),
      ].some((value) => value?.includes('The method of loci is a strategy for memory enhancement'))),
    );
    assert.equal(answerInAccessibleLabels, false, 'The hidden answer must not leak through accessible labels.');

    const dialogMetrics = await page.locator('[role="dialog"]').evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    }));
    assert.ok(dialogMetrics.scrollWidth <= dialogMetrics.clientWidth, 'The mobile dialog must not overflow horizontally.');
    for (const actionName of ['Exit to routes', 'Abandon']) {
      const bounds = await page.getByRole('button', { name: actionName }).boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390, `${actionName} must remain within the mobile viewport.`);
    }

    const progress = page.getByRole('progressbar', { name: 'Session progress' });
    await progress.waitFor();
    const progressTransition = await progress.evaluate((element) => getComputedStyle(element.firstElementChild).transitionDuration);
    assert.equal(progressTransition, '0s', 'Progress animation must be disabled when reduced motion is requested.');

    // From the focused cue, Tab reaches the transient response and then the recall action.
    await page.keyboard.press('Tab');
    const responseField = page.getByRole('textbox', { name: 'Your recalled answer (optional; not saved)' });
    assert.equal(
      await responseField.evaluate((element) => element === document.activeElement),
      true,
      'Tab from the cue should reach the optional response field.',
    );
    await page.keyboard.press('Tab');
    const attemptedButton = page.getByRole('button', { name: "I've attempted recall" });
    assert.equal(
      await attemptedButton.evaluate((element) => element === document.activeElement),
      true,
      'The recall attempt action should be reachable by Tab.',
    );
    await page.keyboard.press('Enter');
    const lowConfidence = page.getByRole('radio', { name: 'Low' });
    await lowConfidence.waitFor();
    assert.equal(
      await lowConfidence.evaluate((element) => element === document.activeElement),
      true,
      'After attempting recall, focus should move to the confidence options.',
    );
    await page.keyboard.press('Space');
    await page.keyboard.press('Tab');
    const skipConfidence = page.getByRole('button', { name: 'Skip confidence rating' });
    assert.equal(
      await skipConfidence.evaluate((element) => element === document.activeElement),
      true,
      'The confidence-skip control should be keyboard reachable.',
    );
    await page.keyboard.press('Tab');
    const revealButton = page.getByRole('button', { name: 'Reveal answer' });
    assert.equal(
      await revealButton.evaluate((element) => element === document.activeElement),
      true,
      'The reveal action should follow the confidence controls in the tab order.',
    );
    await page.keyboard.press('Enter');
    const answerHeading = page.getByRole('heading', { name: 'SAVED NOTE CONTENT' });
    await answerHeading.waitFor();
    assert.equal(
      await answerHeading.evaluate((element) => element === document.activeElement),
      true,
      'Revealing the answer should move focus to the answer heading.',
    );
    await page.keyboard.press('Tab');
    const correctButton = page.getByRole('button', { name: 'Correct', exact: true });
    assert.equal(
      await correctButton.evaluate((element) => element === document.activeElement),
      true,
      'The first self-grade should be keyboard reachable.',
    );
    await page.keyboard.press('Enter');
    const continueButton = page.getByRole('button', { name: 'Continue' });
    await continueButton.waitFor();
    assert.equal(
      await continueButton.evaluate((element) => element === document.activeElement),
      true,
      'After grading, focus should move to Continue.',
    );
    await page.keyboard.press('Enter');
    await page.getByText('Enter gateway to The Oak Desk').waitFor();
    assert.equal(
      await page.getByRole('heading', { name: 'Gateway to Study Desk' }).evaluate((element) => element === document.activeElement),
      true,
      'Entering a gateway step should focus its navigation cue.',
    );

    // Exit without abandoning; the saved session must be resumable after a reload.
    await page.getByRole('button', { name: 'Exit to routes' }).click();
    await page.getByText('Resume a session').waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Guided Recall routes' }).click();
    await page.getByRole('button', { name: 'Resume' }).click();
    await page.getByText('Enter gateway to The Oak Desk').waitFor();

    await page.getByRole('button', { name: 'Enter gateway to The Oak Desk' }).click();
    await page.getByText('Draft Paper', { exact: true }).waitFor();
    await page.getByRole('button', { name: "I've attempted recall" }).click();
    await page.getByRole('button', { name: 'Skip confidence rating' }).click();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByText('Finish the project.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Missed', exact: true }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Session completed', { exact: true }).waitFor();
    await page.getByText('50%', { exact: true }).waitFor();
    const resultHeading = page.getByRole('heading', { name: 'Session completed' });
    assert.equal(
      await resultHeading.evaluate((element) => element === document.activeElement),
      true,
      'Completing the session should focus the result heading.',
    );
    await page.getByRole('button', { name: 'Return to routes' }).click();
    assert.equal(
      await page.locator('#guided-recall-dialog-title').evaluate((element) => element === document.activeElement),
      true,
      'Exiting the runner should restore focus to the route manager heading.',
    );
    await page.getByRole('button', { name: 'Show learning analytics' }).click();
    await page.getByRole('heading', { name: 'Learning analytics' }).waitFor();
    await page.getByRole('heading', { name: 'Session history' }).waitFor();
    await page.getByText('Browser integration route', { exact: true }).first().waitFor();
    await page.getByText('50% self-reported score', { exact: true }).first().waitFor();
    await page.getByRole('heading', { name: 'Current note review signals' }).waitFor();
    await page.getByRole('button', { name: 'Review Draft Paper' }).click();
    await page.getByRole('heading', { name: 'Manual review' }).waitFor();
    await page.getByText('Draft Paper', { exact: true }).waitFor();
    await page.getByRole('button', { name: "I've attempted recall" }).click();
    await page.getByRole('radio', { name: 'High' }).check();
    await page.getByRole('button', { name: 'Reveal answer' }).click();
    await page.getByText('Finish the project.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Correct', exact: true }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByText('Session completed', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Return to routes' }).click();
    await page.getByRole('heading', { name: 'Learning analytics' }).waitFor();
    await page.getByText('Manual review', { exact: true }).first().waitFor();
    await page.getByRole('button', { name: 'Close', exact: true }).click();



    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export backup' }).click(),
    ]);
    const downloadPath = await download.path();
    assert.ok(downloadPath, 'The backup download should have a readable temporary path.');
    const backup = JSON.parse(await readFile(downloadPath, 'utf8'));
    assert.equal(backup.recall.routes.length, 1);
    assert.equal(backup.recall.routes[0].name, 'Browser integration route');
    assert.deepEqual(backup.recall.routes[0].steps.map((step) => step.kind), ['recall', 'gateway', 'recall']);
    assert.equal(backup.recall.sessions.length, 2);
    assert.equal(backup.recall.sessions[0].state, 'completed');
    assert.equal(backup.recall.sessions[0].attempts.length, 2);
    assert.equal(backup.recall.sessions[1].routeNameSnapshot, 'Manual review');
    assert.equal(backup.recall.sessions[1].state, 'completed');
    assert.equal(backup.recall.sessions[1].attempts.length, 1);
    assert.equal(backup.recall.sessions[1].attempts[0].markerId, 'note-2');
    assert.equal(backup.recall.attempts.length, 3);
    assert.deepEqual(backup.recall.sessions[0].attempts.map((attempt) => attempt.grade), ['correct', 'missed']);

    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Import backup' }).click();
    await page.locator('input[aria-label="Choose LociCanvas JSON backup file"]').setInputFiles(downloadPath);
    await page.getByRole('button', { name: 'Validate and Import' }).click();
    await page.getByRole('button', { name: 'Guided Recall routes' }).click();
    await page.getByText('Browser integration route').waitFor();

    const tempDirectory = await mkdtemp(join(tmpdir(), 'locicanvas-legacy-'));
    try {
      const legacyPath = join(tempDirectory, 'palace-only-backup.json');
      await writeFile(legacyPath, JSON.stringify({
        schemaVersion: 1,
        palaces: backup.palaces,
      }));
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.getByRole('button', { name: 'Import backup' }).click();
      await page.locator('input[aria-label="Choose LociCanvas JSON backup file"]').setInputFiles(legacyPath);
      await page.getByRole('button', { name: 'Validate and Import' }).click();
      await page.getByRole('button', { name: 'Guided Recall routes' }).click();
      await page.getByText('No routes yet. Create one to connect existing memory markers into a recall sequence.').waitFor();
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }

    await context.close();
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
  }
});
