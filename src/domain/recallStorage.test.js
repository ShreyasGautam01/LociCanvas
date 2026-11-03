import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECALL_STORAGE_KEY,
  canPersistRecallLocally,
  createEmptyRecallData,
  parseRecallBackup,
  parseRecallStorage,
  persistRecallBackupAtomically,
  serializeRecallBackup,
  serializeRecallStorage,
} from './recallStorage.js';

const palaces = [
  {
    id: 'library',
    name: 'Library',
    imageUrl: '',
    items: [
      { id: 'note-1', type: 'note', x: 20, y: 30, title: 'Neuron', content: 'An excitable cell.' },
    ],
  },
];

const route = {
  id: 'route-1',
  name: 'Neuroscience',
  description: '',
  schemaVersion: 1,
  createdAt: '2026-11-04T10:00:00.000Z',
  updatedAt: '2026-11-04T10:00:00.000Z',
  steps: [
    { id: 'step-1', kind: 'recall', palaceId: 'library', markerId: 'note-1' },
  ],
};

class MemoryStorage {
  values = new Map();
  failOnKey = null;
  failCount = 0;

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (key === this.failOnKey && this.failCount > 0) {
      this.failCount -= 1;
      throw new Error('QuotaExceededError');
    }
    this.values.set(key, String(value));
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test('recall storage round-trips versioned routes and empty history collections', () => {
  const data = { ...createEmptyRecallData(), routes: [route] };
  const serialized = serializeRecallStorage(data);
  assert.deepEqual(parseRecallStorage(serialized), data);
});

test('rejects malformed recall payloads and duplicate route IDs', () => {
  assert.throws(() => parseRecallStorage('{broken'));
  assert.throws(() => parseRecallStorage(JSON.stringify({ schemaVersion: 2, routes: [] })));
  assert.throws(() => parseRecallStorage(JSON.stringify({
    schemaVersion: 1,
    routes: [route, route],
  })), /duplicate route IDs/i);
});

test('backup export includes both palace data and recall routes', () => {
  const data = { ...createEmptyRecallData(), routes: [route] };
  const raw = serializeRecallBackup(palaces, data);
  const parsed = parseRecallBackup(raw);
  assert.deepEqual(parsed.palaces, palaces);
  assert.deepEqual(parsed.recallData, data);
  assert.equal(parsed.hasRecall, true);
});

test('older palace-only backups remain importable and explicitly have no recall payload', () => {
  const legacyArray = JSON.stringify(palaces);
  const legacyEnvelope = JSON.stringify({ schemaVersion: 1, palaces });
  for (const raw of [legacyArray, legacyEnvelope]) {
    const parsed = parseRecallBackup(raw);
    assert.deepEqual(parsed.palaces, palaces);
    assert.deepEqual(parsed.recallData, createEmptyRecallData());
    assert.equal(parsed.hasRecall, false);
  }
});

test('backup import rejects invalid recall data before returning palace data', () => {
  const raw = JSON.stringify({
    schemaVersion: 1,
    palaces,
    recall: { schemaVersion: 99, routes: [] },
  });
  assert.throws(() => parseRecallBackup(raw), /Guided Recall backup/i);
});

test('backup import may preserve structurally valid but broken references for repair in the editor', () => {
  const broken = {
    ...createEmptyRecallData(),
    routes: [{ ...route, steps: [{ ...route.steps[0], markerId: 'deleted-note' }] }],
  };
  const parsed = parseRecallBackup(JSON.stringify({
    schemaVersion: 1,
    palaces,
    recall: broken,
  }));
  assert.equal(parsed.recallData.routes.length, 1);
  assert.equal(parsed.recallData.routes[0].steps[0].markerId, 'deleted-note');
});

test('route storage budget is enforced independently of palace storage', () => {
  assert.equal(canPersistRecallLocally(createEmptyRecallData()), true);
  const oversized = {
    ...createEmptyRecallData(),
    routes: [{ ...route, description: 'x'.repeat(300_000) }],
  };
  assert.equal(canPersistRecallLocally(oversized), false);
});

test('atomic backup persistence rolls both keys back when the recall write fails', () => {
  const storage = new MemoryStorage();
  storage.setItem('palace-key', 'old-palaces');
  storage.setItem(RECALL_STORAGE_KEY, 'old-recall');
  storage.failOnKey = RECALL_STORAGE_KEY;
  storage.failCount = 1;

  assert.throws(() => persistRecallBackupAtomically(storage, {
    palaceKey: 'palace-key',
    palaces,
    recallData: { ...createEmptyRecallData(), routes: [route] },
  }), /previous palace and recall data were restored/i);
  assert.equal(storage.getItem('palace-key'), 'old-palaces');
  assert.equal(storage.getItem(RECALL_STORAGE_KEY), 'old-recall');
});

test('atomic backup persistence writes both keys when both operations succeed', () => {
  const storage = new MemoryStorage();
  persistRecallBackupAtomically(storage, {
    palaceKey: 'palace-key',
    palaces,
    recallData: { ...createEmptyRecallData(), routes: [route] },
  });
  assert.deepEqual(JSON.parse(storage.getItem('palace-key')).palaces, palaces);
  assert.deepEqual(parseRecallStorage(storage.getItem(RECALL_STORAGE_KEY)).routes, [route]);
});
