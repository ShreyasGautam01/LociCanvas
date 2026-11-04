import {
  calculateItemRecentPerformance,
  calculateRecallSessionScore,
  createRecallItemFingerprint,
  RECALL_DEFAULTS,
} from './recallModel.js';

const VALID_WINDOWS = [7, 30, 60, null];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isValidTime(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function withinWindow(timestamp, nowMs, lookbackDays) {
  if (!isValidTime(timestamp)) return false;
  if (lookbackDays === null) return Date.parse(timestamp) <= nowMs;
  return Date.parse(timestamp) >= nowMs - (lookbackDays * 86_400_000)
    && Date.parse(timestamp) <= nowMs;
}

function collectPersistedAttempts(sessions) {
  const seen = new Set();
  return sessions
    .flatMap((session) => asArray(session?.attempts))
    .filter((attempt) => {
      if (!attempt || typeof attempt !== 'object' || typeof attempt.id !== 'string') return false;
      if (seen.has(attempt.id)) return false;
      seen.add(attempt.id);
      return true;
    })
    .sort((left, right) => Date.parse(right.attemptedAt) - Date.parse(left.attemptedAt));
}

function createLocationIndex(palaces, sessions) {
  const index = new Map();
  for (const palace of asArray(palaces)) {
    for (const marker of asArray(palace?.items)) {
      if (marker?.type !== 'note') continue;
      const key = palace.id + '::' + marker.id;
      index.set(key, {
        palaceId: palace.id,
        palaceName: palace.name || 'Untitled environment',
        markerId: marker.id,
        title: typeof marker.title === 'string' ? marker.title : 'Untitled memory',
        fingerprint: createRecallItemFingerprint(marker.title, marker.content),
      });
    }
  }

  const historicalNames = new Map();
  for (const session of sessions) {
    for (const location of asArray(session?.locationSnapshots)) {
      historicalNames.set(location.palaceId, location.palaceNameSnapshot);
    }
  }
  return { currentNotes: index, historicalNames };
}

function summarizeSession(session) {
  const score = calculateRecallSessionScore(session);
  const started = Date.parse(session.startedAt);
  const ended = isValidTime(session.endedAt) ? Date.parse(session.endedAt) : NaN;
  const durationSeconds = Number.isFinite(started) && Number.isFinite(ended)
    ? Math.max(0, Math.round((ended - started) / 1000))
    : null;
  return {
    id: session.id,
    routeId: session.routeId,
    routeName: session.routeNameSnapshot,
    state: session.state,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationSeconds,
    scorePercent: score.scorePercent,
    scoredAttemptCount: score.scoredAttemptCount,
    recallStopCount: score.recallStopCount,
    skippedCount: score.skippedCount,
    counts: score.counts,
    attempts: asArray(session.attempts),
  };
}

/**
 * Read-only analytics projection over saved session snapshots.
 *
 * The nested session attempts are the source of truth for the projection.
 * The flat recallData.attempts array is a redundant index maintained for
 * export/other consumers, so a stale index cannot inflate these reports.
 */
export function deriveRecallAnalytics(recallData, palaces, {
  now = new Date().toISOString(),
  lookbackDays = 30,
} = {}) {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error('Analytics reference time must be valid.');
  if (!VALID_WINDOWS.includes(lookbackDays)) {
    throw new Error('Analytics window must be 7, 30, 60, or all time.');
  }

  const sessions = asArray(recallData?.sessions);
  const attempts = collectPersistedAttempts(sessions)
    .filter((attempt) => withinWindow(attempt.attemptedAt, nowMs, lookbackDays));
  const visibleSessions = sessions
    .filter((session) => withinWindow(session.startedAt, nowMs, lookbackDays))
    .map(summarizeSession)
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));

  const routeGroups = new Map();
  for (const session of visibleSessions) {
    const key = session.routeId;
    if (!routeGroups.has(key)) {
      routeGroups.set(key, {
        routeId: key,
        routeName: session.routeName,
        sessions: [],
      });
    }
    routeGroups.get(key).sessions.push(session);
  }
  const routeHistory = [...routeGroups.values()]
    .sort((left, right) => Date.parse(right.sessions[0].startedAt) - Date.parse(left.sessions[0].startedAt));

  const locations = createLocationIndex(palaces, sessions);
  const revisionGroups = new Map();
  for (const attempt of attempts) {
    const key = [attempt.palaceId, attempt.markerId, attempt.itemFingerprint].join('::');
    if (!revisionGroups.has(key)) {
      const current = locations.currentNotes.get(attempt.palaceId + '::' + attempt.markerId);
      revisionGroups.set(key, {
        key,
        palaceId: attempt.palaceId,
        palaceName: current?.palaceName || locations.historicalNames.get(attempt.palaceId) || 'Environment no longer available',
        markerId: attempt.markerId,
        prompt: attempt.promptSnapshot || current?.title || 'Untitled memory',
        itemFingerprint: attempt.itemFingerprint,
        isCurrentRevision: Boolean(current && current.fingerprint === attempt.itemFingerprint),
        attempts: [],
        counts: { correct: 0, partial: 0, missed: 0 },
      });
    }
    const group = revisionGroups.get(key);
    group.attempts.push(attempt);
    if (Object.hasOwn(group.counts, attempt.grade)) group.counts[attempt.grade] += 1;
  }
  const itemRevisionHistory = [...revisionGroups.values()]
    .map((group) => ({
      ...group,
      attempts: [...group.attempts].sort((left, right) => Date.parse(right.attemptedAt) - Date.parse(left.attemptedAt)),
    }))
    .sort((left, right) => Date.parse(right.attempts[0].attemptedAt) - Date.parse(left.attempts[0].attemptedAt));

  const weakItemAttempts = collectPersistedAttempts(sessions);
  const frequentlyMissedItems = [];
  for (const note of locations.currentNotes.values()) {
    const performance = calculateItemRecentPerformance(weakItemAttempts, {
      markerId: note.markerId,
      palaceId: note.palaceId,
      itemFingerprint: note.fingerprint,
      now,
      lookbackDays: RECALL_DEFAULTS.lookbackDays,
      recentExposureCount: RECALL_DEFAULTS.recentExposureCount,
      minimumExposures: RECALL_DEFAULTS.minimumExposures,
      frequentlyMissedThreshold: RECALL_DEFAULTS.frequentlyMissedThreshold,
    });
    if (performance.scoredExposures === 0) continue;
    frequentlyMissedItems.push({
      ...note,
      ...performance,
    });
  }
  frequentlyMissedItems.sort((left, right) =>
    right.missRate - left.missRate || right.scoredExposures - left.scoredExposures);

  const highConfidenceMisses = attempts
    .filter((attempt) => attempt.grade === 'missed' && attempt.confidence === 'high')
    .map((attempt) => ({
      ...attempt,
      routeName: sessions.find((session) => session.id === attempt.sessionId)?.routeNameSnapshot || 'Unknown route',
      palaceName: locations.currentNotes.get(attempt.palaceId + '::' + attempt.markerId)?.palaceName
        || locations.historicalNames.get(attempt.palaceId)
        || 'Environment no longer available',
    }));

  const totalCounts = attempts.reduce((counts, attempt) => {
    if (Object.hasOwn(counts, attempt.grade)) counts[attempt.grade] += 1;
    return counts;
  }, { correct: 0, partial: 0, missed: 0 });

  return {
    generatedAt: now,
    lookbackDays,
    sessions: visibleSessions,
    routeHistory,
    itemRevisionHistory,
    frequentlyMissedItems,
    highConfidenceMisses,
    totals: {
      sessionCount: visibleSessions.length,
      completedCount: visibleSessions.filter((session) => session.state === 'completed').length,
      abandonedCount: visibleSessions.filter((session) => session.state === 'abandoned').length,
      inProgressCount: visibleSessions.filter((session) => session.state === 'in_progress').length,
      scoredAttemptCount: attempts.length,
      counts: totalCounts,
    },
    weaknessRule: {
      lookbackDays: RECALL_DEFAULTS.lookbackDays,
      recentExposureCount: RECALL_DEFAULTS.recentExposureCount,
      minimumExposures: RECALL_DEFAULTS.minimumExposures,
      threshold: RECALL_DEFAULTS.frequentlyMissedThreshold,
    },
  };
}
