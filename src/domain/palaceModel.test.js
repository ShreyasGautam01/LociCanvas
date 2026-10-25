import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampPercent,
  createStableId,
  isValidHttpsUrl,
  isValidImageSource,
  MAX_BACKGROUND_DATA_URL_LENGTH,
  estimatePalaceStorageBytes,
  canPersistPalacesLocally,
  deletePalaceAndIncomingGateways,
  moveMarkerInPalaces,
  parsePalaceStorage,
  pointerToCanvasPercent,
  serializePalaceStorage,
  searchPalaces,
} from './palaceModel.js';

const sample = [
  {
    id: 'library',
    name: 'Library',
    imageUrl: '',
    items: [
      { id: 'note-1', type: 'note', x: 20, y: 30, title: 'A note', content: '' },
      { id: 'gateway-1', type: 'gateway', x: 70, y: 80, targetId: 'desk', title: 'Desk' },
    ],
  },
  {
    id: 'desk',
    name: 'Desk',
    imageUrl: '',
    items: [],
  },
];

test('clampPercent confines coordinates to the canvas bounds', () => {
  assert.equal(clampPercent(-10), 0);
  assert.equal(clampPercent(42.5), 42.5);
  assert.equal(clampPercent(120), 100);
  assert.equal(clampPercent(Number.NaN), 0);
});

test('pointerToCanvasPercent converts pointer coordinates relative to the canvas', () => {
  assert.deepEqual(pointerToCanvasPercent(150, 75, {
    left: 50, top: 25, width: 200, height: 100,
  }), { x: 50, y: 50 });
  assert.deepEqual(pointerToCanvasPercent(-10, 200, {
    left: 0, top: 0, width: 100, height: 100,
  }), { x: 0, y: 100 });
  assert.equal(pointerToCanvasPercent(1, 1, {
    left: 0, top: 0, width: 0, height: 10,
  }), null);
});

test('moveMarkerInPalaces updates only the selected marker and clamps coordinates', () => {
  const updated = moveMarkerInPalaces(sample, 'library', 'note-1', 150, -2);
  assert.deepEqual(
    { x: updated[0].items[0].x, y: updated[0].items[0].y },
    { x: 100, y: 0 },
  );
  assert.equal(updated[0].items[1].x, 70);
  assert.equal(updated[1], sample[1]);
});

test('deleting a palace removes gateways pointing to it', () => {
  const remaining = deletePalaceAndIncomingGateways(sample, 'desk');
  assert.deepEqual(remaining.map((palace) => palace.id), ['library']);
  assert.deepEqual(remaining[0].items.map((item) => item.id), ['note-1']);
  assert.equal(deletePalaceAndIncomingGateways(sample, 'missing'), sample);
});

test('legacy array data and versioned envelopes can be read', () => {
  assert.deepEqual(parsePalaceStorage(JSON.stringify(sample)), sample);
  assert.deepEqual(parsePalaceStorage(serializePalaceStorage(sample)), sample);
});

test('invalid data is rejected rather than silently reset', () => {
  assert.throws(() => parsePalaceStorage('{bad json'));
  assert.throws(() => parsePalaceStorage(JSON.stringify([
    { id: 'library', name: 'Library', items: [
      { id: 'gateway-1', type: 'gateway', x: 50, y: 50, targetId: 'missing' },
    ] },
  ])));
});


test('accepts only HTTPS URLs and optionally empty backgrounds', () => {
  assert.equal(isValidHttpsUrl('', true), true);
  assert.equal(isValidHttpsUrl('', false), false);
  assert.equal(isValidHttpsUrl('https://images.example.com/palace.jpg'), true);
  assert.equal(isValidHttpsUrl('http://images.example.com/palace.jpg'), false);
  assert.equal(isValidHttpsUrl('javascript:alert(1)'), false);
  assert.equal(isValidHttpsUrl('not a URL'), false);
});

test('generates prefixed IDs that are not fixed timestamps', () => {
  const first = createStableId('palace');
  const second = createStableId('palace');
  assert.match(first, /^palace-/);
  assert.match(second, /^palace-/);
  assert.notEqual(first, second);
});


test('searchPalaces searches palace names, note titles, and note content case-insensitively', () => {
  const results = searchPalaces(sample, 'NOTE');
  assert.deepEqual(results.map((result) => ({
    type: result.type,
    palaceId: result.palaceId,
    title: result.title,
  })), [
    { type: 'marker', palaceId: 'library', title: 'A note' },
  ]);

  const contentResults = searchPalaces(sample, 'note');
  assert.ok(contentResults.some((result) => result.type === 'marker' && result.itemId === 'note-1'));
  const bodyResults = searchPalaces([{
    id: 'biology',
    name: 'Biology',
    items: [{ id: 'cell-note', type: 'note', x: 40, y: 60, title: 'Cell', content: 'Mitochondria make ATP' }],
  }], 'MITOCHONDRIA');
  assert.ok(bodyResults.some((result) => result.itemId === 'cell-note' && result.excerpt === 'Mitochondria make ATP'));
  const palaceResults = searchPalaces(sample, 'desk');
  assert.ok(palaceResults.some((result) => result.type === 'palace' && result.palaceId === 'desk'));
  assert.ok(palaceResults.some((result) => result.type === 'marker' && result.itemId === 'gateway-1'));
});

test('searchPalaces returns no results for blank queries and limits results to 50', () => {
  assert.deepEqual(searchPalaces(sample, '   '), []);
  assert.deepEqual(searchPalaces(null, 'library'), []);
  const manyPalaces = Array.from({ length: 60 }, (_, index) => ({
    id: `palace-${index}`,
    name: `Library ${index}`,
    items: [],
  }));
  assert.equal(searchPalaces(manyPalaces, 'library').length, 50);
});


test('image sources allow HTTPS URLs and bounded raster image data URLs only', () => {
  assert.equal(isValidImageSource('', true), true);
  assert.equal(isValidImageSource('https://images.example.com/palace.jpg', false), true);
  assert.equal(isValidImageSource('http://images.example.com/palace.jpg', false), false);
  assert.equal(isValidImageSource('javascript:alert(1)', false), false);
  assert.equal(isValidImageSource('data:image/webp;base64,QUJD', false), true);
  assert.equal(isValidImageSource('data:image/png;base64,QUJD', false), true);
  assert.equal(isValidImageSource('data:image/svg+xml;base64,PHN2Zz4=', false), false);
  assert.equal(
    isValidImageSource(`data:image/webp;base64,${'A'.repeat(MAX_BACKGROUND_DATA_URL_LENGTH)}`, false),
    false,
  );
});

test('local storage size estimation is conservative and oversized imports are rejected', () => {
  assert.equal(estimatePalaceStorageBytes(sample), JSON.stringify({
    schemaVersion: 1,
    palaces: sample,
  }).length * 2);
  assert.equal(canPersistPalacesLocally(sample), true);

  const oversized = [{
    id: 'large',
    name: 'Large collection',
    imageUrl: '',
    items: [{ id: 'large-note', type: 'note', x: 50, y: 50, title: 'Text', content: 'x'.repeat(2_200_000) }],
  }];
  assert.equal(canPersistPalacesLocally(oversized), false);
  assert.throws(
    () => parsePalaceStorage(JSON.stringify(oversized), { enforceLocalLimit: true }),
    /too large for reliable browser storage/i,
  );
});
