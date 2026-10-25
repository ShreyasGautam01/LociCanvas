export const PALACE_DATA_VERSION = 1;

export function isValidHttpsUrl(value, allowEmpty = true) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return allowEmpty;

  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function createStableId(prefix = 'item') {
  const id = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${id}`;
}

export function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

export function pointerToCanvasPercent(clientX, clientY, rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;

  return {
    x: clampPercent(((clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((clientY - rect.top) / rect.height) * 100),
  };
}

export function moveMarkerInPalaces(palaces, palaceId, markerId, x, y) {
  const nextX = clampPercent(x);
  const nextY = clampPercent(y);

  return palaces.map((palace) => {
    if (palace.id !== palaceId) return palace;

    return {
      ...palace,
      items: palace.items.map((item) =>
        item.id === markerId ? { ...item, x: nextX, y: nextY } : item,
      ),
    };
  });
}

export function deletePalaceAndIncomingGateways(palaces, palaceId) {
  if (!palaces.some((palace) => palace.id === palaceId)) return palaces;

  return palaces
    .filter((palace) => palace.id !== palaceId)
    .map((palace) => ({
      ...palace,
      items: palace.items.filter(
        (item) => !(item.type === 'gateway' && item.targetId === palaceId),
      ),
    }));
}

export function parsePalaceStorage(raw) {
  const parsed = JSON.parse(raw);
  const palaces = Array.isArray(parsed)
    ? parsed
    : parsed?.schemaVersion === PALACE_DATA_VERSION &&
        Array.isArray(parsed.palaces)
      ? parsed.palaces
      : null;

  if (!palaces || palaces.length === 0) {
    throw new Error('Unsupported or empty LociCanvas data format.');
  }

  const palaceIds = new Set();

  for (const palace of palaces) {
    if (
      !palace ||
      typeof palace.id !== 'string' ||
      !palace.id ||
      typeof palace.name !== 'string' ||
      !Array.isArray(palace.items) ||
      palaceIds.has(palace.id)
    ) {
      throw new Error('The saved palace collection is invalid.');
    }
    palaceIds.add(palace.id);
  }

  for (const palace of palaces) {
    const markerIds = new Set();

    for (const item of palace.items) {
      if (
        !item ||
        typeof item.id !== 'string' ||
        !item.id ||
        !['note', 'gateway'].includes(item.type) ||
        !Number.isFinite(Number(item.x)) ||
        !Number.isFinite(Number(item.y)) ||
        Number(item.x) < 0 ||
        Number(item.x) > 100 ||
        Number(item.y) < 0 ||
        Number(item.y) > 100 ||
        markerIds.has(item.id)
      ) {
        throw new Error('The saved collection contains an invalid marker.');
      }

      if (item.type === 'gateway' && !palaceIds.has(item.targetId)) {
        throw new Error('The saved collection contains a broken gateway.');
      }

      markerIds.add(item.id);
    }
  }

  return palaces;
}

export function serializePalaceStorage(palaces) {
  return JSON.stringify({
    schemaVersion: PALACE_DATA_VERSION,
    palaces,
  });
}
