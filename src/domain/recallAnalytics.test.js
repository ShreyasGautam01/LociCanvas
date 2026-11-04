import test from 'node:test';
import assert from 'node:assert/strict';

import { deriveRecallAnalytics } from './recallAnalytics.js';
import { createRecallItemFingerprint } from './recallModel.js';

const now = '2026-11-04T12:00:00.000Z';
const palaces = [{
  id: 'library',
  name: 'Library',
  items: [
    { id: 'note-1', type: 'note', title: 'Neuron', content: 'A nerve cell.' },
    { id: 'note-2', type: 'note', title: 'Synapse', content: 'A junction.' },
  ],
}];
const currentFingerprint = createRecallItemFingerprint('Neuron', 'A nerve cell.');

function makeAttempt(id, sessionId, markerId, grade, confidence, attemptedAt, fingerprint = currentFingerprint) {
  return {
    id,
    sessionId,
    routeStepId: 'step-' + id,
    palaceId: 'library',
    markerId,
    itemFingerprint: fingerprint,
    promptSnapshot: markerId === 'note-1' ? 'Neuron' : 'Synapse',
    grade,
    confidence,
    attemptedAt,
  };
}

function makeSession(id, routeId, state, startedAt, attempts, overrides = {}) {
  return {
    id,
    schemaVersion: 1,
    routeId,
    routeNameSnapshot: routeId === 'route-1' ? 'Neuroscience' : 'Biology',
    routeSnapshot: [{ id: 'step-' + id, kind: 'recall', palaceId: 'library', markerId: 'note-1' }],
    recallSnapshots: [],
    locationSnapshots: [{
      routeStepId: 'step-' + id,
      kind: 'recall',
      palaceId: 'library',
      palaceNameSnapshot: 'Library',
      markerId: 'note-1',
      markerTitleSnapshot: 'Neuron',
      markerXSnapshot: 20,
      markerYSnapshot: 30,
    }],
    state,
    startedAt,
    endedAt: state === 'in_progress' ? null : new Date(Date.parse(startedAt) + 60_000).toISOString(),
    currentStepIndex: 1,
    attempts,
    skippedStepIds: [],
    traversedGatewayStepIds: [],
    ...overrides,
  };
}

test('derives session and route history from saved session records', () => {
  const sessions = [
    makeSession('s1', 'route-1', 'completed', '2026-11-03T10:00:00.000Z', [
      makeAttempt('a1', 's1', 'note-1', 'correct', 'high', '2026-11-03T10:01:00.000Z'),
    ]),
    makeSession('s2', 'route-1', 'abandoned', '2026-11-02T10:00:00.000Z', [
      makeAttempt('a2', 's2', 'note-1', 'missed', 'high', '2026-11-02T10:01:00.000Z'),
    ]),
    makeSession('s3', 'route-2', 'in_progress', '2026-11-01T10:00:00.000Z', []),
  ];
  const analytics = deriveRecallAnalytics({ sessions, attempts: [] }, palaces, { now, lookbackDays: 30 });

  assert.equal(analytics.totals.sessionCount, 3);
  assert.equal(analytics.totals.completedCount, 1);
  assert.equal(analytics.totals.abandonedCount, 1);
  assert.equal(analytics.totals.scoredAttemptCount, 2);
  assert.equal(analytics.sessions[0].id, 's1');
  assert.equal(analytics.sessions[0].scorePercent, 100);
  assert.equal(analytics.sessions[1].scorePercent, 0);
  assert.deepEqual(analytics.routeHistory.map((route) => route.routeId), ['route-1', 'route-2']);
  assert.equal(analytics.highConfidenceMisses.length, 1);
  assert.equal(analytics.highConfidenceMisses[0].attemptId, undefined);
});

test('keeps current and previous note revisions separate', () => {
  const oldFingerprint = createRecallItemFingerprint('Neuron', 'An older definition.');
  const sessions = [
    makeSession('old', 'route-1', 'completed', '2026-11-01T10:00:00.000Z', [
      makeAttempt('old-attempt', 'old', 'note-1', 'missed', 'medium', '2026-11-01T10:01:00.000Z', oldFingerprint),
    ]),
    makeSession('new', 'route-1', 'completed', '2026-11-02T10:00:00.000Z', [
      makeAttempt('new-attempt', 'new', 'note-1', 'correct', 'low', '2026-11-02T10:01:00.000Z'),
    ]),
  ];
  const analytics = deriveRecallAnalytics({ sessions }, palaces, { now, lookbackDays: 60 });
  assert.equal(analytics.itemRevisionHistory.length, 2);
  assert.equal(analytics.itemRevisionHistory.filter((item) => item.isCurrentRevision).length, 1);
  assert.equal(analytics.itemRevisionHistory.find((item) => !item.isCurrentRevision).counts.missed, 1);
});

test('frequently missed view uses only current note revision and exposes the fixed 5/60/3/50 rule', () => {
  const sessions = Array.from({ length: 3 }, (_, index) => makeSession(
    'weak-' + index,
    'route-1',
    'completed',
    new Date(Date.parse(now) - ((index + 1) * 86_400_000)).toISOString(),
    [makeAttempt('weak-a-' + index, 'weak-' + index, 'note-1', 'missed', 'high',
      new Date(Date.parse(now) - ((index + 1) * 86_400_000) + 60_000).toISOString())],
  ));
  const analytics = deriveRecallAnalytics({ sessions }, palaces, { now, lookbackDays: 30 });
  assert.equal(analytics.frequentlyMissedItems.length, 1);
  assert.equal(analytics.frequentlyMissedItems[0].status, 'frequently_missed');
  assert.equal(analytics.frequentlyMissedItems[0].weightedMisses, 3);
  assert.deepEqual(analytics.weaknessRule, {
    lookbackDays: 60,
    recentExposureCount: 5,
    minimumExposures: 3,
    threshold: 0.5,
  });
});

test('flat orphan attempts cannot inflate session-derived reports and same marker IDs are palace-scoped', () => {
  const otherPalace = [{
    id: 'lab',
    name: 'Lab',
    items: [{ id: 'note-1', type: 'note', title: 'Neuron', content: 'A nerve cell.' }],
  }];
  const sessions = [
    makeSession('s1', 'route-1', 'completed', '2026-11-03T10:00:00.000Z', [
      makeAttempt('a1', 's1', 'note-1', 'correct', 'low', '2026-11-03T10:01:00.000Z'),
    ]),
  ];
  const flat = [makeAttempt('orphan', 'unknown', 'note-1', 'missed', 'high', '2026-11-03T10:02:00.000Z')];
  const analytics = deriveRecallAnalytics({ sessions, attempts: flat }, [...palaces, ...otherPalace], { now });
  assert.equal(analytics.totals.scoredAttemptCount, 1);
  assert.equal(analytics.itemRevisionHistory.length, 1);
});

test('time windows filter history while all-time includes past attempts', () => {
  const sessions = [
    makeSession('old', 'route-1', 'completed', '2026-09-01T10:00:00.000Z', [
      makeAttempt('old-a', 'old', 'note-1', 'missed', 'high', '2026-09-01T10:01:00.000Z'),
    ]),
    makeSession('recent', 'route-1', 'completed', '2026-11-03T10:00:00.000Z', [
      makeAttempt('recent-a', 'recent', 'note-1', 'correct', 'low', '2026-11-03T10:01:00.000Z'),
    ]),
  ];
  const recent = deriveRecallAnalytics({ sessions, attempts: [] }, palaces, { now, lookbackDays: 7 });
  const all = deriveRecallAnalytics({ sessions, attempts: [] }, palaces, { now, lookbackDays: null });
  assert.equal(recent.sessions.length, 1);
  assert.equal(recent.totals.scoredAttemptCount, 1);
  assert.equal(all.sessions.length, 2);
  assert.equal(all.totals.scoredAttemptCount, 2);
});

test('rejects unknown time windows', () => {
  assert.throws(() => deriveRecallAnalytics({}, palaces, { now, lookbackDays: 14 }), /window must be/);
});
