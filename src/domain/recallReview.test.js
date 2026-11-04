import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MANUAL_REVIEW_ROUTE_ID,
  createManualReviewRoute,
} from './recallReview.js';
import { createRecallItemFingerprint, createRecallSessionSnapshot, validateRecallRoute } from './recallModel.js';

const palaces = [{
  id: 'library',
  name: 'Library',
  imageUrl: '',
  items: [{
    id: 'note-1',
    type: 'note',
    x: 20,
    y: 30,
    title: 'Neuron',
    content: 'A neuron is an excitable cell.',
  }],
}];
const fingerprint = createRecallItemFingerprint('Neuron', 'A neuron is an excitable cell.');
const now = '2026-11-04T12:00:00.000Z';

test('builds a valid one-note review route at the original palace and marker', () => {
  const route = createManualReviewRoute(palaces, {
    palaceId: 'library',
    markerId: 'note-1',
    itemFingerprint: fingerprint,
    now,
    stepId: 'review-step-1',
  });

  assert.equal(route.id, MANUAL_REVIEW_ROUTE_ID);
  assert.equal(route.name, 'Manual review');
  assert.deepEqual(route.steps, [{
    id: 'review-step-1',
    kind: 'recall',
    palaceId: 'library',
    markerId: 'note-1',
  }]);
  assert.equal(validateRecallRoute(route, palaces).valid, true);
});

test('manual review snapshots the current note and locus without mutating custom routes', () => {
  const route = createManualReviewRoute(palaces, {
    palaceId: 'library',
    markerId: 'note-1',
    itemFingerprint: fingerprint,
    now,
    stepId: 'review-step-1',
  });
  const session = createRecallSessionSnapshot(route, palaces, {
    sessionId: 'manual-session-1',
    now,
  });

  assert.equal(session.routeId, MANUAL_REVIEW_ROUTE_ID);
  assert.equal(session.routeNameSnapshot, 'Manual review');
  assert.equal(session.recallSnapshots[0].promptSnapshot, 'Neuron');
  assert.equal(session.recallSnapshots[0].answerSnapshot, 'A neuron is an excitable cell.');
  assert.equal(session.locationSnapshots[0].markerXSnapshot, 20);
  assert.equal(session.locationSnapshots[0].markerYSnapshot, 30);
  assert.equal(session.routeSnapshot.length, 1);
});

test('rejects missing or retargeted source notes instead of reviewing another marker', () => {
  assert.throws(() => createManualReviewRoute([], {
    palaceId: 'library',
    markerId: 'note-1',
    itemFingerprint: fingerprint,
    now,
  }), /environment.*no longer exists/i);

  const deleted = [{ ...palaces[0], items: [] }];
  assert.throws(() => createManualReviewRoute(deleted, {
    palaceId: 'library',
    markerId: 'note-1',
    itemFingerprint: fingerprint,
    now,
  }), /note.*no longer exists/i);
});

test('rejects stale analytics revisions after the underlying note is edited', () => {
  const edited = structuredClone(palaces);
  edited[0].items[0].content = 'Edited definition.';
  assert.throws(() => createManualReviewRoute(edited, {
    palaceId: 'library',
    markerId: 'note-1',
    itemFingerprint: fingerprint,
    now,
  }), /note changed/i);
});

test('rejects a gateway and invalid identity / timestamp data', () => {
  const gatewayPalaces = [{
    id: 'library',
    name: 'Library',
    items: [{ id: 'gateway-1', type: 'gateway', targetId: 'other', title: 'Next' }],
  }];
  assert.throws(() => createManualReviewRoute(gatewayPalaces, {
    palaceId: 'library',
    markerId: 'gateway-1',
    itemFingerprint: fingerprint,
    now,
  }), /note.*no longer exists/i);

  assert.throws(() => createManualReviewRoute(palaces, {
    palaceId: '',
    markerId: 'note-1',
    itemFingerprint: fingerprint,
    now,
  }), /palace ID/i);

  assert.throws(() => createManualReviewRoute(palaces, {
    palaceId: 'library',
    markerId: 'note-1',
    itemFingerprint: fingerprint,
    now: '2026-11-04T12:00:00+00:00',
  }), /valid ISO timestamp/i);
});
