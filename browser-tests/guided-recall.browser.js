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
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();

    await page.goto(APP_URL);
    await page.getByRole('button', { name: 'Explore the sample' }).click();
    await page.getByRole('button', { name: 'Guided Recall routes' }).click();
    await page.getByRole('button', { name: 'Create route' }).click();

    await page.getByLabel('Route name').fill('Browser integration route');
    await addRouteStep(page, /Recall · The Grand Library \/ Philosophy of Loci/);
    await addRouteStep(page, /Gateway · The Grand Library/);
    await addRouteStep(page, /Recall · The Oak Desk \/ Draft Paper/);

    await page.getByRole('button', { name: 'Save route' }).click();
    await page.getByText('2 recall stops · 1 gateways').waitFor();
    assert.equal(await page.getByText('Browser integration route').count() > 0, true);

    await page.reload();
    await page.getByRole('button', { name: 'Guided Recall routes' }).click();
    await page.getByText('Browser integration route').waitFor();
    await page.getByText('2 recall stops · 1 gateways').waitFor();
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
