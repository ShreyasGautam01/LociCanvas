import { createStableId } from './palaceModel.js';
import { createRecallItemFingerprint } from './recallModel.js';

export const MANUAL_REVIEW_ROUTE_ID = 'locicanvas:manual-review:v1';

/**
 * Build a transient one-note route for a learner-selected review.
 *
 * The route is intentionally not added to recallData.routes. The resulting
 * session snapshot persists the exact cue, answer and original locus, while
 * preserving the learner's authored route collection.
 */
export function createManualReviewRoute(palaces, {
  palaceId,
  markerId,
  itemFingerprint,
  now = new Date().toISOString(),
  stepId = createStableId('manual-review-step'),
} = {}) {
  if (!Array.isArray(palaces)) throw new Error('Palace data must be an array.');
  if (typeof palaceId !== 'string' || !palaceId.trim()) throw new Error('A palace ID is required.');
  if (typeof markerId !== 'string' || !markerId.trim()) throw new Error('A note marker ID is required.');
  if (typeof itemFingerprint !== 'string' || !itemFingerprint.trim()) {
    throw new Error('A note revision fingerprint is required.');
  }
  if (
    typeof now !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(now) ||
    !Number.isFinite(Date.parse(now))
  ) {
    throw new Error('Manual review time must be a valid ISO timestamp.');
  }
  if (typeof stepId !== 'string' || !stepId.trim()) throw new Error('A review step ID is required.');

  const palace = palaces.find((candidate) => candidate?.id === palaceId);
  if (!palace) throw new Error('The environment for this review no longer exists.');

  const marker = Array.isArray(palace.items)
    ? palace.items.find((candidate) => candidate?.id === markerId)
    : null;
  if (!marker || marker.type !== 'note') {
    throw new Error('The note for this review no longer exists in its original environment.');
  }

  const currentFingerprint = createRecallItemFingerprint(marker.title, marker.content);
  if (currentFingerprint !== itemFingerprint) {
    throw new Error('This note changed after the review list was loaded. Refresh the list and choose its current revision.');
  }

  return {
    id: MANUAL_REVIEW_ROUTE_ID,
    name: 'Manual review',
    description: 'A learner-selected single-note review at the note’s original locus. No review interval is assigned.',
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    steps: [{
      id: stepId,
      kind: 'recall',
      palaceId,
      markerId,
    }],
  };
}
