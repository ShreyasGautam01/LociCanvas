import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampPercent,
  createStableId,
  isValidHttpsUrl,
  deletePalaceAndIncomingGateways,
  moveMarkerInPalaces,
  parsePalaceStorage,
  pointerToCanvasPercent,
  serializePalaceStorage,
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
