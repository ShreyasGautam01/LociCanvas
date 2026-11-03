import {
  canPersistPalacesLocally,
  parsePalaceStorage,
  serializePalaceStorage,
} from './palaceModel.js';
import { RECALL_DATA_VERSION } from './recallModel.js';

export const RECALL_STORAGE_KEY = 'locicanvas_recall_v1_data';
export const RECALL_RECOVERY_KEY = 'locicanvas_recall_v1_recovery';
export const MAX_LOCAL_RECALL_BYTES = 512 * 1024;

export function createEmptyRecallData() {
  return {
    schemaVersion: RECALL_DATA_VERSION,
    routes: [],
    sessions: [],
    attempts: [],
  };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeRecallPayload(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    value.schemaVersion !== RECALL_DATA_VERSION ||
    !Array.isArray(value.routes)
  ) {
    throw new Error('The Guided Recall backup has an unsupported or invalid format.');
  }

  const routes = value.routes.map((route) => {
    if (
      !route ||
      typeof route !== 'object' ||
      Array.isArray(route) ||
      !isNonEmptyString(route.id) ||
      !isNonEmptyString(route.name) ||
      route.schemaVersion !== RECALL_DATA_VERSION ||
      !Array.isArray(route.steps)
    ) {
      throw new Error('The Guided Recall backup contains an invalid route definition.');
    }

    const steps = route.steps.map((step) => {
      if (
        !step ||
        typeof step !== 'object' ||
        Array.isArray(step) ||
        !isNonEmptyString(step.id) ||
        !isNonEmptyString(step.palaceId) ||
        !isNonEmptyString(step.markerId) ||
        !['recall', 'gateway'].includes(step.kind) ||
        (step.kind === 'gateway' && !isNonEmptyString(step.targetPalaceId))
      ) {
        throw new Error('The Guided Recall backup contains an invalid route step.');
      }
      return { ...step };
    });

    return {
      ...route,
      description: typeof route.description === 'string' ? route.description : '',
      steps,
    };
  });

  const routeIds = new Set();
  for (const route of routes) {
    if (routeIds.has(route.id)) {
      throw new Error('The Guided Recall backup contains duplicate route IDs.');
    }
    routeIds.add(route.id);
  }

  const sessions = value.sessions === undefined ? [] : value.sessions;
  const attempts = value.attempts === undefined ? [] : value.attempts;
  if (!Array.isArray(sessions) || !Array.isArray(attempts)) {
    throw new Error('The Guided Recall backup contains invalid session history.');
  }

  return {
    schemaVersion: RECALL_DATA_VERSION,
    routes,
    sessions: sessions.map((session) => ({ ...session })),
    attempts: attempts.map((attempt) => ({ ...attempt })),
  };
}

export function parseRecallStorage(raw) {
  return normalizeRecallPayload(JSON.parse(raw));
}

export function serializeRecallStorage(recallData) {
  return JSON.stringify(normalizeRecallPayload(recallData));
}

export function canPersistRecallLocally(recallData) {
  try {
    return serializeRecallStorage(recallData).length * 2 <= MAX_LOCAL_RECALL_BYTES;
  } catch {
    return false;
  }
}

export function loadRecallStorage(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem(RECALL_STORAGE_KEY);
    if (!raw) return { recallData: createEmptyRecallData(), issue: '' };
    return { recallData: parseRecallStorage(raw), issue: '' };
  } catch (error) {
    let recoverySaved = false;
    try {
      const raw = storage?.getItem(RECALL_STORAGE_KEY);
      if (raw) {
        storage.setItem(RECALL_RECOVERY_KEY, raw);
        recoverySaved = true;
      }
    } catch {
      // Recovery is best-effort when browser storage is unavailable or full.
    }
    return {
      recallData: createEmptyRecallData(),
      issue: (error instanceof Error ? error.message : 'Guided Recall data could not be loaded.')
        + (recoverySaved ? ' A raw recovery copy was preserved.' : ''),
    };
  }
}

export function serializeRecallBackup(palaces, recallData) {
  const palaceEnvelope = JSON.parse(serializePalaceStorage(palaces));
  const recall = normalizeRecallPayload(recallData);
  const backup = { ...palaceEnvelope, recall };
  const serialized = JSON.stringify(backup);
  if (!canPersistPalacesLocally(palaces)) {
    throw new Error('The palace collection exceeds the browser storage budget.');
  }
  if (!canPersistRecallLocally(recall)) {
    throw new Error('Guided Recall data exceeds its 512 KiB local storage budget.');
  }
  return serialized;
}

/**
 * Validate both halves of a backup before exposing either one to the caller.
 * Older palace-only backups remain supported and produce an empty recall set.
 */
export function parseRecallBackup(raw, { enforceLocalLimit = false } = {}) {
  const parsed = JSON.parse(raw);
  const palaces = parsePalaceStorage(raw, { enforceLocalLimit });
  const hasRecall = Boolean(
    parsed && !Array.isArray(parsed) &&
    Object.prototype.hasOwnProperty.call(parsed, 'recall')
  );
  const recallData = hasRecall
    ? normalizeRecallPayload(parsed.recall)
    : createEmptyRecallData();

  if (enforceLocalLimit && !canPersistRecallLocally(recallData)) {
    throw new Error('Guided Recall data exceeds its 512 KiB local storage budget.');
  }

  return { palaces, recallData, hasRecall };
}

/**
 * localStorage has no transaction primitive. Save both keys with a rollback
 * snapshot so a failed second write does not leave a half-restored backup.
 */
export function persistRecallBackupAtomically(storage, {
  palaceKey,
  recallKey = RECALL_STORAGE_KEY,
  palaces,
  recallData,
}) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new Error('Browser storage is unavailable.');
  }

  const palaceValue = serializePalaceStorage(palaces);
  const recallValue = serializeRecallStorage(recallData);
  if (!canPersistPalacesLocally(palaces)) {
    throw new Error('The palace collection exceeds its 4 MiB local storage budget.');
  }
  if (!canPersistRecallLocally(recallData)) {
    throw new Error('Guided Recall data exceeds its 512 KiB local storage budget.');
  }

  const previousPalace = storage.getItem(palaceKey);
  const previousRecall = storage.getItem(recallKey);

  try {
    storage.setItem(palaceKey, palaceValue);
    storage.setItem(recallKey, recallValue);
  } catch (error) {
    try {
      if (previousPalace === null) storage.removeItem(palaceKey);
      else storage.setItem(palaceKey, previousPalace);
      if (previousRecall === null) storage.removeItem(recallKey);
      else storage.setItem(recallKey, previousRecall);
    } catch {
      throw new Error('The backup restore failed and the browser also blocked rollback. Export any remaining data before continuing.');
    }
    throw new Error('The backup restore failed. Previous palace and recall data were restored.');
  }

  return true;
}

export function persistRecallData(storage, recallData) {
  const serialized = serializeRecallStorage(recallData);
  if (!canPersistRecallLocally(recallData)) {
    throw new Error('Guided Recall data exceeds its 512 KiB local storage budget. Export a backup before removing routes.');
  }
  storage.setItem(RECALL_STORAGE_KEY, serialized);
  return true;
}
