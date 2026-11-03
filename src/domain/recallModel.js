import { createStableId } from './palaceModel.js';

export const RECALL_DATA_VERSION = 1;

export const RECALL_GRADES = Object.freeze(['correct', 'partial', 'missed']);
export const RECALL_CONFIDENCE_LEVELS = Object.freeze(['low', 'medium', 'high']);

export const RECALL_DEFAULTS = Object.freeze({
  recentExposureCount: 5,
  lookbackDays: 60,
  minimumExposures: 3,
  frequentlyMissedThreshold: 0.5,
  partialCredit: 0.5,
});

const GRADE_WEIGHTS = Object.freeze({
  correct: 1,
  partial: RECALL_DEFAULTS.partialCredit,
  missed: 0,
});

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidTimestamp(value) {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function findPalace(palaces, palaceId) {
  return palaces.find((palace) => palace?.id === palaceId) ?? null;
}

function findMarker(palace, markerId) {
  return palace?.items?.find((item) => item?.id === markerId) ?? null;
}

function routeError(code, path, message) {
  return { code, path, message };
}

/**
 * Validate a route against the current palace graph.
 *
 * Returns a structured result rather than throwing so the route editor can
 * show all repairable problems in one pass.
 */
export function validateRecallRoute(route, palaces) {
  const errors = [];

  if (!route || typeof route !== 'object' || Array.isArray(route)) {
    return {
      valid: false,
      errors: [routeError('INVALID_ROUTE', 'route', 'The route must be an object.')],
    };
  }

  if (!isNonEmptyString(route.id)) {
    errors.push(routeError('INVALID_ROUTE_ID', 'id', 'The route needs a stable ID.'));
  }
  if (!isNonEmptyString(route.name)) {
    errors.push(routeError('INVALID_ROUTE_NAME', 'name', 'Enter a route name.'));
  }
  if (route.schemaVersion !== RECALL_DATA_VERSION) {
    errors.push(routeError('UNSUPPORTED_ROUTE_VERSION', 'schemaVersion', 'This route uses an unsupported schema version.'));
  }
  if (!Array.isArray(palaces) || palaces.length === 0) {
    errors.push(routeError('MISSING_PALACES', 'palaces', 'No palace environments are available.'));
  }
  if (!Array.isArray(route.steps) || route.steps.length === 0) {
    errors.push(routeError('EMPTY_ROUTE', 'steps', 'Add at least one recall stop.'));
    return { valid: false, errors };
  }

  if (route.steps[0]?.kind !== 'recall') {
    errors.push(routeError('ROUTE_MUST_START_WITH_RECALL', 'steps[0]', 'A route must begin at a recall stop.'));
  }
  if (route.steps.at(-1)?.kind !== 'recall') {
    errors.push(routeError('ROUTE_MUST_END_WITH_RECALL', `steps[${route.steps.length - 1}]`, 'A route must end at a recall stop.'));
  }

  const palaceIndex = new Map(
    (Array.isArray(palaces) ? palaces : [])
      .filter((palace) => isNonEmptyString(palace?.id))
      .map((palace) => [palace.id, palace]),
  );
  const stepIds = new Set();
  const recallMarkerKeys = new Set();
  let currentPalaceId = null;
  let recallCount = 0;

  route.steps.forEach((step, index) => {
    const path = `steps[${index}]`;

    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      errors.push(routeError('INVALID_STEP', path, 'This route step is malformed.'));
      return;
    }

    if (!isNonEmptyString(step.id)) {
      errors.push(routeError('INVALID_STEP_ID', `${path}.id`, 'Every route step needs a stable ID.'));
    } else if (stepIds.has(step.id)) {
      errors.push(routeError('DUPLICATE_STEP_ID', `${path}.id`, 'Route step IDs must be unique.'));
    } else {
      stepIds.add(step.id);
    }

    if (!isNonEmptyString(step.palaceId)) {
      errors.push(routeError('MISSING_STEP_PALACE', `${path}.palaceId`, 'Choose the palace containing this marker.'));
      return;
    }

    const palace = palaceIndex.get(step.palaceId);
    if (!palace) {
      errors.push(routeError('MISSING_PALACE', `${path}.palaceId`, 'The referenced palace no longer exists.'));
      return;
    }

    const marker = findMarker(palace, step.markerId);
    if (!marker) {
      errors.push(routeError('MISSING_MARKER', `${path}.markerId`, 'The referenced marker no longer exists in this palace.'));
      return;
    }

    if (step.kind === 'recall') {
      recallCount += 1;
      if (index === 0) currentPalaceId = step.palaceId;

      if (marker.type !== 'note') {
        errors.push(routeError('RECALL_REQUIRES_NOTE', `${path}.markerId`, 'A recall step must reference a memory note.'));
      }

      if (currentPalaceId !== step.palaceId) {
        errors.push(routeError('BROKEN_ROUTE_CONTINUITY', `${path}.palaceId`, 'This recall stop is in a different palace. Add the gateway steps needed to reach it.'));
      }

      const markerKey = `${step.palaceId}::${step.markerId}`;
      if (recallMarkerKeys.has(markerKey)) {
        errors.push(routeError('DUPLICATE_RECALL_MARKER', `${path}.markerId`, 'A note can appear only once in a route.'));
      } else {
        recallMarkerKeys.add(markerKey);
      }
      return;
    }

    if (step.kind === 'gateway') {
      if (marker.type !== 'gateway') {
        errors.push(routeError('GATEWAY_REQUIRES_GATEWAY_MARKER', `${path}.markerId`, 'A gateway step must reference a gateway marker.'));
      }

      if (currentPalaceId === null) currentPalaceId = step.palaceId;
      if (currentPalaceId !== step.palaceId) {
        errors.push(routeError('BROKEN_GATEWAY_CONTINUITY', `${path}.palaceId`, 'This gateway is not in the palace reached by the previous route step.'));
      }

      if (!isNonEmptyString(step.targetPalaceId) || step.targetPalaceId !== marker.targetId) {
        errors.push(routeError('GATEWAY_TARGET_MISMATCH', `${path}.targetPalaceId`, 'The route destination must match the gateway marker destination.'));
      } else if (!palaceIndex.has(step.targetPalaceId)) {
        errors.push(routeError('MISSING_GATEWAY_DESTINATION', `${path}.targetPalaceId`, 'The gateway destination palace no longer exists.'));
      } else {
        currentPalaceId = step.targetPalaceId;
      }
      return;
    }

    errors.push(routeError('UNKNOWN_STEP_KIND', `${path}.kind`, 'Route steps must be recall or gateway steps.'));
  });

  if (recallCount === 0) {
    errors.push(routeError('NO_RECALL_STOPS', 'steps', 'A route must contain at least one recall stop.'));
  }

  return { valid: errors.length === 0, errors };
}

/**
 * FNV-1a 64-bit content fingerprint. It is a stable revision key, not a
 * cryptographic hash and must never be used for authentication or security.
 */
export function createRecallItemFingerprint(title, content) {
  const source = JSON.stringify([
    typeof title === 'string' ? title : '',
    typeof content === 'string' ? content : '',
  ]);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const bytes = new TextEncoder().encode(source);

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }

  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}

/**
 * Capture the route and note content at session start. A running session
 * therefore remains stable even if the source palace or route is edited.
 */
export function createRecallSessionSnapshot(route, palaces, {
  sessionId = createStableId('recall-session'),
  now = new Date().toISOString(),
} = {}) {
  const validation = validateRecallRoute(route, palaces);
  if (!validation.valid) {
    const summary = validation.errors.map((error) => error.message).join(' ');
    const error = new Error(`Cannot start an invalid recall route. ${summary}`);
    error.validationErrors = validation.errors;
    throw error;
  }
  if (!isNonEmptyString(sessionId)) throw new Error('A session ID is required.');
  if (!isValidTimestamp(now)) throw new Error('Session start time must be a valid ISO timestamp.');

  const routeSnapshot = route.steps.map((step) => ({ ...step }));
  const recallSnapshots = routeSnapshot
    .filter((step) => step.kind === 'recall')
    .map((step) => {
      const palace = findPalace(palaces, step.palaceId);
      const marker = findMarker(palace, step.markerId);
      const promptSnapshot = typeof marker.title === 'string' ? marker.title : '';
      const answerSnapshot = typeof marker.content === 'string' ? marker.content : '';
      return {
        routeStepId: step.id,
        palaceId: step.palaceId,
        markerId: step.markerId,
        promptSnapshot,
        answerSnapshot,
        itemFingerprint: createRecallItemFingerprint(promptSnapshot, answerSnapshot),
      };
    });

  return {
    id: sessionId,
    schemaVersion: RECALL_DATA_VERSION,
    routeId: route.id,
    routeNameSnapshot: route.name.trim(),
    routeSnapshot,
    recallSnapshots,
    state: 'in_progress',
    startedAt: now,
    endedAt: null,
    currentStepIndex: 0,
    attempts: [],
    skippedStepIds: [],
    traversedGatewayStepIds: [],
  };
}

function getCurrentStep(session) {
  if (!session || !Array.isArray(session.routeSnapshot)) return null;
  return session.routeSnapshot[session.currentStepIndex] ?? null;
}

function assertActiveSession(session) {
  if (!session || session.state !== 'in_progress') {
    throw new Error('Only an in-progress recall session can be changed.');
  }
}

function assertCurrentRecallStep(session, routeStepId) {
  const step = getCurrentStep(session);
  if (!step || step.kind !== 'recall' || step.id !== routeStepId) {
    throw new Error('The selected route step is not the current recall stop.');
  }
  return step;
}

/**
 * Record a user-reported grade. Free-text responses are intentionally not
 * accepted or persisted by this domain model.
 */
export function recordRecallAttempt(session, {
  routeStepId,
  grade,
  confidence = null,
  cueToRevealMs,
  attemptedAt = new Date().toISOString(),
  attemptId = createStableId('recall-attempt'),
} = {}) {
  assertActiveSession(session);
  const step = assertCurrentRecallStep(session, routeStepId);

  if (!RECALL_GRADES.includes(grade)) {
    throw new Error('Choose correct, partial, or missed. Use skip when no recall attempt was made.');
  }
  if (confidence !== null && !RECALL_CONFIDENCE_LEVELS.includes(confidence)) {
    throw new Error('Confidence must be low, medium, high, or null.');
  }
  if (!isValidTimestamp(attemptedAt)) throw new Error('Attempt time must be a valid ISO timestamp.');
  if (!isNonEmptyString(attemptId)) throw new Error('An attempt ID is required.');
  if (cueToRevealMs !== undefined && (!Number.isFinite(cueToRevealMs) || cueToRevealMs < 0)) {
    throw new Error('Cue-to-reveal time must be a non-negative finite number.');
  }

  const snapshot = session.recallSnapshots.find((item) => item.routeStepId === step.id);
  if (!snapshot) throw new Error('The recall snapshot for this route step is missing.');

  const alreadyAttempted = session.attempts.some((attempt) =>
    attempt.markerId === step.markerId && attempt.palaceId === step.palaceId,
  );
  if (alreadyAttempted || session.skippedStepIds.includes(step.id)) {
    throw new Error('This recall stop already has an outcome for this session.');
  }

  const attempt = {
    id: attemptId,
    sessionId: session.id,
    routeStepId: step.id,
    palaceId: snapshot.palaceId,
    markerId: snapshot.markerId,
    itemFingerprint: snapshot.itemFingerprint,
    promptSnapshot: snapshot.promptSnapshot,
    confidence,
    grade,
    ...(cueToRevealMs === undefined ? {} : { cueToRevealMs }),
    attemptedAt,
  };

  return { ...session, attempts: [...session.attempts, attempt] };
}

/** Record a deliberate no-attempt outcome. Skips are not failed recalls. */
export function skipRecallStep(session, {
  routeStepId,
} = {}) {
  assertActiveSession(session);
  const step = assertCurrentRecallStep(session, routeStepId);

  const alreadyAttempted = session.attempts.some((attempt) =>
    attempt.markerId === step.markerId && attempt.palaceId === step.palaceId,
  );
  if (alreadyAttempted || session.skippedStepIds.includes(step.id)) {
    throw new Error('This recall stop already has an outcome for this session.');
  }

  return { ...session, skippedStepIds: [...session.skippedStepIds, step.id] };
}

/**
 * Advance only after a recall outcome. Gateway steps require explicit
 * confirmation from the runner (the learner pressed Enter gateway).
 */
export function advanceRecallSession(session, {
  gatewayEntered = false,
  at = new Date().toISOString(),
} = {}) {
  assertActiveSession(session);
  if (!isValidTimestamp(at)) throw new Error('Transition time must be a valid ISO timestamp.');

  const step = getCurrentStep(session);
  if (!step) throw new Error('There is no current route step.');

  if (step.kind === 'recall') {
    const hasAttempt = session.attempts.some((attempt) => attempt.routeStepId === step.id);
    const wasSkipped = session.skippedStepIds.includes(step.id);
    if (!hasAttempt && !wasSkipped) {
      throw new Error('Grade or skip this recall stop before continuing.');
    }
  } else if (step.kind === 'gateway') {
    if (!gatewayEntered) throw new Error('Enter the gateway before continuing.');
    if (!session.traversedGatewayStepIds.includes(step.id)) {
      session = {
        ...session,
        traversedGatewayStepIds: [...session.traversedGatewayStepIds, step.id],
      };
    }
  } else {
    throw new Error('The current route step is invalid.');
  }

  const nextIndex = session.currentStepIndex + 1;
  if (nextIndex >= session.routeSnapshot.length) {
    return { ...session, currentStepIndex: nextIndex, state: 'completed', endedAt: at };
  }
  return { ...session, currentStepIndex: nextIndex };
}

export function abandonRecallSession(session, {
  at = new Date().toISOString(),
} = {}) {
  assertActiveSession(session);
  if (!isValidTimestamp(at)) throw new Error('Abandon time must be a valid ISO timestamp.');
  return { ...session, state: 'abandoned', endedAt: at };
}

export function calculateRecallSessionScore(session) {
  const attempts = Array.isArray(session?.attempts) ? session.attempts : [];
  const counts = { correct: 0, partial: 0, missed: 0 };
  for (const attempt of attempts) {
    if (Object.hasOwn(counts, attempt?.grade)) counts[attempt.grade] += 1;
  }

  const scoredAttemptCount = counts.correct + counts.partial + counts.missed;
  const weightedPoints = Object.entries(counts).reduce(
    (sum, [grade, count]) => sum + (count * GRADE_WEIGHTS[grade]),
    0,
  );
  const skippedCount = Array.isArray(session?.skippedStepIds) ? session.skippedStepIds.length : 0;
  const recallStopCount = Array.isArray(session?.routeSnapshot)
    ? session.routeSnapshot.filter((step) => step?.kind === 'recall').length
    : scoredAttemptCount + skippedCount;

  return {
    scorePercent: scoredAttemptCount === 0 ? null : (weightedPoints / scoredAttemptCount) * 100,
    scoredAttemptCount,
    recallStopCount,
    skippedCount,
    counts,
  };
}

/**
 * Calculate a transparent recent-performance status for one exact note
 * revision. Only scored attempts count; skips and gateway steps are excluded.
 */
export function calculateItemRecentPerformance(attempts, {
  markerId,
  itemFingerprint,
  now = new Date().toISOString(),
  lookbackDays = RECALL_DEFAULTS.lookbackDays,
  recentExposureCount = RECALL_DEFAULTS.recentExposureCount,
  minimumExposures = RECALL_DEFAULTS.minimumExposures,
  frequentlyMissedThreshold = RECALL_DEFAULTS.frequentlyMissedThreshold,
} = {}) {
  if (!Array.isArray(attempts)) throw new Error('Attempts must be an array.');
  if (!isNonEmptyString(markerId) || !isNonEmptyString(itemFingerprint)) {
    throw new Error('A marker ID and item fingerprint are required.');
  }
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error('The performance reference time must be valid.');
  if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) throw new Error('Lookback days must be positive.');
  if (!Number.isInteger(recentExposureCount) || recentExposureCount < 1) throw new Error('Recent exposure count must be a positive integer.');
  if (!Number.isInteger(minimumExposures) || minimumExposures < 1) throw new Error('Minimum exposures must be a positive integer.');
  if (!Number.isFinite(frequentlyMissedThreshold) || frequentlyMissedThreshold < 0 || frequentlyMissedThreshold > 1) {
    throw new Error('Frequently-missed threshold must be between 0 and 1.');
  }

  const cutoffMs = nowMs - (lookbackDays * 24 * 60 * 60 * 1000);
  const ordered = attempts
    .filter((attempt) => {
      if (
        attempt?.markerId !== markerId ||
        attempt?.itemFingerprint !== itemFingerprint ||
        !RECALL_GRADES.includes(attempt?.grade) ||
        !isNonEmptyString(attempt?.sessionId) ||
        !isValidTimestamp(attempt?.attemptedAt)
      ) return false;
      const timestamp = Date.parse(attempt.attemptedAt);
      return timestamp >= cutoffMs && timestamp <= nowMs;
    })
    .sort((left, right) => Date.parse(right.attemptedAt) - Date.parse(left.attemptedAt));

  const distinctSessionAttempts = [];
  const seenSessions = new Set();
  for (const attempt of ordered) {
    if (seenSessions.has(attempt.sessionId)) continue;
    seenSessions.add(attempt.sessionId);
    distinctSessionAttempts.push(attempt);
    if (distinctSessionAttempts.length >= recentExposureCount) break;
  }

  const counts = { correct: 0, partial: 0, missed: 0 };
  for (const attempt of distinctSessionAttempts) counts[attempt.grade] += 1;

  const scoredExposures = distinctSessionAttempts.length;
  const weightedMisses = (counts.missed * (1 - GRADE_WEIGHTS.missed))
    + (counts.partial * (1 - GRADE_WEIGHTS.partial));
  const missRate = scoredExposures === 0 ? null : weightedMisses / scoredExposures;
  let status = 'not_enough_history';
  if (scoredExposures >= minimumExposures) {
    status = missRate >= frequentlyMissedThreshold ? 'frequently_missed' : 'monitor';
  }

  return {
    status,
    markerId,
    itemFingerprint,
    scoredExposures,
    weightedMisses,
    missRate,
    counts,
    lookbackDays,
    recentExposureCount,
    minimumExposures,
    frequentlyMissedThreshold,
    attempts: distinctSessionAttempts,
  };
}
