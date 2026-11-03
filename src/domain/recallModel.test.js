import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RECALL_DEFAULTS,
  abandonRecallSession,
  advanceRecallSession,
  calculateItemRecentPerformance,
  calculateRecallSessionScore,
  createRecallItemFingerprint,
  createRecallSessionSnapshot,
  recordRecallAttempt,
  skipRecallStep,
  validateRecallRoute,
} from './recallModel.js';

const palaces = [
  {
    id: 'library',
    name: 'Library',
    imageUrl: '',
    items: [
      { id: 'note-1', type: 'note', x: 20, y: 30, title: 'Neuron', content: 'A neuron is an excitable cell.' },
      { id: 'gateway-1', type: 'gateway', x: 70, y: 80, title: 'Enter lab', targetId: 'lab' },
      { id: 'note-2', type: 'note', x: 40, y: 50, title: 'Synapse', content: 'A synapse connects neurons.' },
    ],
  },
  {
    id: 'lab',
    name: 'Laboratory',
    imageUrl: '',
    items: [
      { id: 'note-3', type: 'note', x: 50, y: 50, title: 'Action potential', content: 'A rapid change in membrane potential.' },
      { id: 'gateway-2', type: 'gateway', x: 80, y: 40, title: 'Return to library', targetId: 'library' },
    ],
  },
];

function makeRoute(steps = [
  { id: 'step-1', kind: 'recall', palaceId: 'library', markerId: 'note-1' },
  { id: 'step-2', kind: 'recall', palaceId: 'library', markerId: 'note-2' },
]) {
  return {
    id: 'route-1',
    name: 'Neuroscience basics',
    description: '',
    schemaVersion: 1,
    createdAt: '2026-11-03T10:00:00.000Z',
    updatedAt: '2026-11-03T10:00:00.000Z',
    steps,
  };
}

function makeAttempt({
  sessionId,
  markerId = 'note-1',
  itemFingerprint = 'fingerprint-v1',
  grade,
  attemptedAt,
}) {
  return {
    id: `attempt-${sessionId}`,
    sessionId,
    routeStepId: `step-${sessionId}`,
    palaceId: 'library',
    markerId,
    itemFingerprint,
    promptSnapshot: 'Neuron',
    confidence: 'medium',
    grade,
    attemptedAt,
  };
}

test('validates a same-palace route containing recall stops only', () => {
  const result = validateRecallRoute(makeRoute(), palaces);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validates route continuity through actual gateway markers', () => {
  const route = makeRoute([
    { id: 'a', kind: 'recall', palaceId: 'library', markerId: 'note-1' },
    { id: 'b', kind: 'gateway', palaceId: 'library', markerId: 'gateway-1', targetPalaceId: 'lab' },
    { id: 'c', kind: 'recall', palaceId: 'lab', markerId: 'note-3' },
  ]);
  assert.equal(validateRecallRoute(route, palaces).valid, true);
});

test('rejects an empty route and a route without recall stops', () => {
  const empty = validateRecallRoute(makeRoute([]), palaces);
  assert.ok(empty.errors.some((error) => error.code === 'EMPTY_ROUTE'));

  const onlyGateway = makeRoute([
    { id: 'g', kind: 'gateway', palaceId: 'library', markerId: 'gateway-1', targetPalaceId: 'lab' },
  ]);
  const result = validateRecallRoute(onlyGateway, palaces);
  assert.ok(result.errors.some((error) => error.code === 'ROUTE_MUST_START_WITH_RECALL'));
  assert.ok(result.errors.some((error) => error.code === 'ROUTE_MUST_END_WITH_RECALL'));
  assert.ok(result.errors.some((error) => error.code === 'NO_RECALL_STOPS'));
});

test('rejects missing palaces, missing markers, and markers of the wrong type', () => {
  const missingPalace = makeRoute([
    { id: 'a', kind: 'recall', palaceId: 'missing', markerId: 'note-1' },
  ]);
  assert.ok(validateRecallRoute(missingPalace, palaces).errors.some((error) => error.code === 'MISSING_PALACE'));

  const missingMarker = makeRoute([
    { id: 'a', kind: 'recall', palaceId: 'library', markerId: 'deleted-note' },
  ]);
  assert.ok(validateRecallRoute(missingMarker, palaces).errors.some((error) => error.code === 'MISSING_MARKER'));

  const wrongType = makeRoute([
    { id: 'a', kind: 'recall', palaceId: 'library', markerId: 'gateway-1' },
  ]);
  assert.ok(validateRecallRoute(wrongType, palaces).errors.some((error) => error.code === 'RECALL_REQUIRES_NOTE'));
});

test('rejects gateway target mismatches and broken continuity', () => {
  const wrongTarget = makeRoute([
    { id: 'a', kind: 'recall', palaceId: 'library', markerId: 'note-1' },
    { id: 'b', kind: 'gateway', palaceId: 'library', markerId: 'gateway-1', targetPalaceId: 'library' },
    { id: 'c', kind: 'recall', palaceId: 'library', markerId: 'note-2' },
  ]);
  assert.ok(validateRecallRoute(wrongTarget, palaces).errors.some((error) => error.code === 'GATEWAY_TARGET_MISMATCH'));

  const discontinuous = makeRoute([
    { id: 'a', kind: 'recall', palaceId: 'library', markerId: 'note-1' },
    { id: 'b', kind: 'recall', palaceId: 'lab', markerId: 'note-3' },
  ]);
  assert.ok(validateRecallRoute(discontinuous, palaces).errors.some((error) => error.code === 'BROKEN_ROUTE_CONTINUITY'));
});

test('rejects duplicate step IDs and repeated note markers', () => {
  const duplicateIds = makeRoute([
    { id: 'same', kind: 'recall', palaceId: 'library', markerId: 'note-1' },
    { id: 'same', kind: 'recall', palaceId: 'library', markerId: 'note-2' },
  ]);
  assert.ok(validateRecallRoute(duplicateIds, palaces).errors.some((error) => error.code === 'DUPLICATE_STEP_ID'));

  const duplicateNote = makeRoute([
    { id: 'a', kind: 'recall', palaceId: 'library', markerId: 'note-1' },
    { id: 'b', kind: 'recall', palaceId: 'library', markerId: 'note-1' },
  ]);
  assert.ok(validateRecallRoute(duplicateNote, palaces).errors.some((error) => error.code === 'DUPLICATE_RECALL_MARKER'));
});

test('item fingerprints are stable for identical content and change when title or content changes', () => {
  const first = createRecallItemFingerprint('Neuron', 'An excitable cell');
  assert.equal(first, createRecallItemFingerprint('Neuron', 'An excitable cell'));
  assert.notEqual(first, createRecallItemFingerprint('Neuron', 'A different answer'));
  assert.notEqual(first, createRecallItemFingerprint('Neurone', 'An excitable cell'));
  assert.match(first, /^fnv1a64:[0-9a-f]{16}$/);
});

test('session snapshots preserve route and note text as they existed at start', () => {
  const route = makeRoute();
  const session = createRecallSessionSnapshot(route, palaces, {
    sessionId: 'session-1',
    now: '2026-11-03T12:00:00.000Z',
  });
  assert.equal(session.state, 'in_progress');
  assert.equal(session.currentStepIndex, 0);
  assert.equal(session.recallSnapshots[0].promptSnapshot, 'Neuron');
  assert.equal(session.recallSnapshots[0].answerSnapshot, 'A neuron is an excitable cell.');
  assert.equal(session.recallSnapshots[0].itemFingerprint, createRecallItemFingerprint('Neuron', 'A neuron is an excitable cell.'));

  const editedPalaces = structuredClone(palaces);
  editedPalaces[0].items[0].content = 'Edited answer';
  assert.equal(session.recallSnapshots[0].answerSnapshot, 'A neuron is an excitable cell.');
  assert.equal(editedPalaces[0].items[0].content, 'Edited answer');
});

test('cannot start an invalid route or a session with invalid metadata', () => {
  assert.throws(
    () => createRecallSessionSnapshot(makeRoute([]), palaces),
    /Cannot start an invalid recall route/,
  );
  assert.throws(
    () => createRecallSessionSnapshot(makeRoute(), palaces, { sessionId: '', now: '2026-11-03T12:00:00Z' }),
    /session ID is required/,
  );
  assert.throws(
    () => createRecallSessionSnapshot(makeRoute(), palaces, {
      sessionId: 'session-offset',
      now: '2026-11-03T12:00:00+00:00',
    }),
    /valid ISO timestamp/,
  );
});

test('records exactly one self-grade for the current recall stop', () => {
  const session = createRecallSessionSnapshot(makeRoute(), palaces, {
    sessionId: 'session-record',
    now: '2026-11-03T12:00:00.000Z',
  });
  const updated = recordRecallAttempt(session, {
    routeStepId: 'step-1',
    grade: 'partial',
    confidence: 'high',
    cueToRevealMs: 3400.5,
    attemptedAt: '2026-11-03T12:01:00.000Z',
    attemptId: 'attempt-1',
  });

  assert.equal(session.attempts.length, 0);
  assert.equal(updated.attempts.length, 1);
  assert.equal(updated.attempts[0].grade, 'partial');
  assert.equal(updated.attempts[0].confidence, 'high');
  assert.equal(updated.attempts[0].itemFingerprint, session.recallSnapshots[0].itemFingerprint);
  assert.equal(updated.attempts[0].cueToRevealMs, 3400.5);

  assert.throws(() => recordRecallAttempt(updated, {
    routeStepId: 'step-1',
    grade: 'correct',
  }), /not the current recall stop|already has an outcome/);
  assert.throws(() => recordRecallAttempt(session, {
    routeStepId: 'step-1',
    grade: 'skipped',
  }), /Choose correct, partial, or missed/);
});

test('skip is a separate outcome and does not create a scored attempt', () => {
  const session = createRecallSessionSnapshot(makeRoute(), palaces, {
    sessionId: 'session-skip',
    now: '2026-11-03T12:00:00.000Z',
  });
  const updated = skipRecallStep(session, { routeStepId: 'step-1' });
  assert.deepEqual(updated.skippedStepIds, ['step-1']);
  assert.equal(updated.attempts.length, 0);
  assert.throws(() => skipRecallStep(updated, { routeStepId: 'step-1' }), /already has an outcome/);
});

test('requires each recall stop to be graded or skipped before advancing', () => {
  const session = createRecallSessionSnapshot(makeRoute(), palaces, {
    sessionId: 'session-advance',
    now: '2026-11-03T12:00:00.000Z',
  });
  assert.throws(() => advanceRecallSession(session), /Grade or skip/);

  const skipped = skipRecallStep(session, { routeStepId: 'step-1' });
  const next = advanceRecallSession(skipped, { at: '2026-11-03T12:01:00.000Z' });
  assert.equal(next.currentStepIndex, 1);
  assert.equal(next.state, 'in_progress');
});

test('gateway steps require explicit entry and never create recall attempts', () => {
  const route = makeRoute([
    { id: 'a', kind: 'recall', palaceId: 'library', markerId: 'note-1' },
    { id: 'b', kind: 'gateway', palaceId: 'library', markerId: 'gateway-1', targetPalaceId: 'lab' },
    { id: 'c', kind: 'recall', palaceId: 'lab', markerId: 'note-3' },
  ]);
  const session = createRecallSessionSnapshot(route, palaces, {
    sessionId: 'session-gateway',
    now: '2026-11-03T12:00:00.000Z',
  });
  const graded = recordRecallAttempt(session, {
    routeStepId: 'a',
    grade: 'correct',
    attemptedAt: '2026-11-03T12:00:30.000Z',
    attemptId: 'attempt-a',
  });
  const atGateway = advanceRecallSession(graded, { at: '2026-11-03T12:01:00.000Z' });
  assert.throws(() => advanceRecallSession(atGateway), /Enter the gateway/);

  const atDestination = advanceRecallSession(atGateway, {
    gatewayEntered: true,
    at: '2026-11-03T12:02:00.000Z',
  });
  assert.equal(atDestination.currentStepIndex, 2);
  assert.deepEqual(atDestination.traversedGatewayStepIds, ['b']);
  assert.equal(atDestination.attempts.length, 1);
  assert.equal(atDestination.attempts[0].markerId, 'note-1');
});

test('completes a session after the final recall outcome and preserves attempts on abandon', () => {
  const route = makeRoute([
    { id: 'a', kind: 'recall', palaceId: 'library', markerId: 'note-1' },
  ]);
  const session = createRecallSessionSnapshot(route, palaces, {
    sessionId: 'session-complete',
    now: '2026-11-03T12:00:00.000Z',
  });
  const graded = recordRecallAttempt(session, {
    routeStepId: 'a',
    grade: 'correct',
    attemptedAt: '2026-11-03T12:01:00.000Z',
    attemptId: 'attempt-a',
  });
  const completed = advanceRecallSession(graded, { at: '2026-11-03T12:02:00.000Z' });
  assert.equal(completed.state, 'completed');
  assert.equal(completed.currentStepIndex, 1);
  assert.equal(completed.attempts.length, 1);
  assert.throws(() => advanceRecallSession(completed), /in-progress/);

  const abandoned = abandonRecallSession(graded, { at: '2026-11-03T12:03:00.000Z' });
  assert.equal(abandoned.state, 'abandoned');
  assert.equal(abandoned.attempts.length, 1);
  assert.equal(abandoned.endedAt, '2026-11-03T12:03:00.000Z');
});

test('session score uses correct/partial/missed only and reports skips separately', () => {
  const result = calculateRecallSessionScore({
    routeSnapshot: [
      { id: 'a', kind: 'recall' },
      { id: 'g', kind: 'gateway' },
      { id: 'b', kind: 'recall' },
      { id: 'c', kind: 'recall' },
    ],
    attempts: [
      { grade: 'correct' },
      { grade: 'partial' },
      { grade: 'missed' },
    ],
    skippedStepIds: ['c'],
  });
  assert.equal(result.scorePercent, 50);
  assert.equal(result.scoredAttemptCount, 3);
  assert.equal(result.recallStopCount, 3);
  assert.equal(result.skippedCount, 1);
  assert.deepEqual(result.counts, { correct: 1, partial: 1, missed: 1 });

  const noScore = calculateRecallSessionScore({
    routeSnapshot: [{ id: 'a', kind: 'recall' }],
    attempts: [],
    skippedStepIds: ['a'],
  });
  assert.equal(noScore.scorePercent, null);
  assert.equal(noScore.scoredAttemptCount, 0);
});

test('frequently-missed algorithm flags the 50% boundary after five scored exposures', () => {
  const now = '2026-11-03T12:00:00.000Z';
  const grades = ['missed', 'partial', 'correct', 'missed', 'correct'];
  const attempts = grades.map((grade, index) => makeAttempt({
    sessionId: `s-${index}`,
    grade,
    attemptedAt: new Date(Date.parse(now) - ((4 - index) * 86_400_000)).toISOString(),
  }));
  const result = calculateItemRecentPerformance(attempts, {
    markerId: 'note-1',
    itemFingerprint: 'fingerprint-v1',
    now,
  });
  assert.equal(result.status, 'frequently_missed');
  assert.equal(result.scoredExposures, 5);
  assert.equal(result.weightedMisses, 2.5);
  assert.equal(result.missRate, 0.5);
});

test('frequently-missed algorithm avoids flags with fewer than three exposures', () => {
  const attempts = [
    makeAttempt({ sessionId: 's-1', grade: 'missed', attemptedAt: '2026-11-02T12:00:00.000Z' }),
    makeAttempt({ sessionId: 's-2', grade: 'missed', attemptedAt: '2026-11-01T12:00:00.000Z' }),
  ];
  const result = calculateItemRecentPerformance(attempts, {
    markerId: 'note-1',
    itemFingerprint: 'fingerprint-v1',
    now: '2026-11-03T12:00:00.000Z',
  });
  assert.equal(result.status, 'not_enough_history');
  assert.equal(result.scoredExposures, 2);
  assert.equal(result.missRate, 1);
});

test('frequently-missed algorithm uses only the latest five unique sessions', () => {
  const attempts = Array.from({ length: 7 }, (_, index) => makeAttempt({
    sessionId: `s-${index}`,
    grade: index < 2 ? 'missed' : 'correct',
    attemptedAt: new Date(Date.parse('2026-11-03T12:00:00.000Z') - ((6 - index) * 60_000)).toISOString(),
  }));
  const result = calculateItemRecentPerformance(attempts, {
    markerId: 'note-1',
    itemFingerprint: 'fingerprint-v1',
    now: '2026-11-03T12:00:00.000Z',
  });
  assert.equal(result.scoredExposures, 5);
  assert.equal(result.status, 'monitor');
  assert.equal(result.counts.correct, 5);
});

test('frequently-missed algorithm enforces the 60-day window and current content revision', () => {
  const attempts = [
    makeAttempt({ sessionId: 'old-1', grade: 'missed', attemptedAt: '2026-08-01T12:00:00.000Z' }),
    makeAttempt({ sessionId: 'old-2', grade: 'missed', attemptedAt: '2026-08-02T12:00:00.000Z' }),
    makeAttempt({ sessionId: 'rev-1', grade: 'missed', itemFingerprint: 'fingerprint-v1', attemptedAt: '2026-11-01T12:00:00.000Z' }),
    makeAttempt({ sessionId: 'rev-2', grade: 'missed', itemFingerprint: 'fingerprint-v2', attemptedAt: '2026-11-02T12:00:00.000Z' }),
  ];
  const originalRevision = calculateItemRecentPerformance(attempts, {
    markerId: 'note-1',
    itemFingerprint: 'fingerprint-v1',
    now: '2026-11-03T12:00:00.000Z',
  });
  const newRevision = calculateItemRecentPerformance(attempts, {
    markerId: 'note-1',
    itemFingerprint: 'fingerprint-v2',
    now: '2026-11-03T12:00:00.000Z',
  });
  assert.equal(originalRevision.scoredExposures, 1);
  assert.equal(newRevision.scoredExposures, 1);
  assert.equal(originalRevision.status, 'not_enough_history');
  assert.equal(newRevision.status, 'not_enough_history');
});

test('frequently-missed algorithm de-duplicates a repeated exposure within one session', () => {
  const attempts = [
    makeAttempt({ sessionId: 'same', grade: 'missed', attemptedAt: '2026-11-03T11:00:00.000Z' }),
    makeAttempt({ sessionId: 'same', grade: 'correct', attemptedAt: '2026-11-03T10:00:00.000Z' }),
    makeAttempt({ sessionId: 'other-1', grade: 'missed', attemptedAt: '2026-11-02T11:00:00.000Z' }),
  ];
  const result = calculateItemRecentPerformance(attempts, {
    markerId: 'note-1',
    itemFingerprint: 'fingerprint-v1',
    now: '2026-11-03T12:00:00.000Z',
  });
  assert.equal(result.scoredExposures, 2);
  assert.equal(result.counts.missed, 2);
});

test('frequently-missed algorithm rejects invalid parameters instead of guessing', () => {
  assert.throws(() => calculateItemRecentPerformance([], {
    markerId: 'note-1',
    itemFingerprint: 'fingerprint-v1',
    lookbackDays: 0,
  }), /Lookback days must be positive/);
  assert.equal(RECALL_DEFAULTS.recentExposureCount, 5);
});
