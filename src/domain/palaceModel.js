export const PALACE_DATA_VERSION = 1;
export const MAX_BACKGROUND_DATA_URL_LENGTH = 500 * 1024;
export const MAX_LOCAL_COLLECTION_BYTES = 4 * 1024 * 1024;

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

/**
 * Accept remote HTTPS images or bounded, browser-generated image data URLs.
 * SVG and arbitrary data URLs are intentionally excluded.
 */
export function isValidImageSource(value, allowEmpty = true) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (!candidate) return allowEmpty;
  if (candidate.length > 4096 && !candidate.startsWith('data:image/')) return false;

  if (candidate.startsWith('data:image/')) {
    return candidate.length <= MAX_BACKGROUND_DATA_URL_LENGTH
      && /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(candidate);
  }

  return isValidHttpsUrl(candidate, false);
}

export function estimatePalaceStorageBytes(palaces) {
  // localStorage accounts for string data in UTF-16 code units in common browsers.
  return serializePalaceStorage(palaces).length * 2;
}

export function canPersistPalacesLocally(palaces) {
  try {
    return estimatePalaceStorageBytes(palaces) <= MAX_LOCAL_COLLECTION_BYTES;
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

export function parsePalaceStorage(raw, { enforceLocalLimit = false } = {}) {
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
    if (palace.imageUrl !== undefined && !isValidImageSource(palace.imageUrl, true)) {
      throw new Error('The saved collection contains an invalid or oversized background image source.');
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

  if (enforceLocalLimit && !canPersistPalacesLocally(palaces)) {
    throw new Error('This backup is too large for reliable browser storage. Remove some uploaded backgrounds or reduce the image sizes.');
  }

  return palaces;
}

export function serializePalaceStorage(palaces) {
  return JSON.stringify({
    schemaVersion: PALACE_DATA_VERSION,
    palaces,
  });
}


/**
 * Search across palace names and marker titles/content for the local-first UI.
 * Results intentionally contain only fields needed by the search-results list.
 */
export function searchPalaces(palaces, query) {
  if (!Array.isArray(palaces) || typeof query !== 'string') return [];

  const term = query.trim().toLocaleLowerCase();
  if (!term) return [];

  const results = [];
  for (const palace of palaces) {
    if (!palace || typeof palace.id !== 'string' || typeof palace.name !== 'string') continue;
    const items = Array.isArray(palace.items) ? palace.items : [];

    if (palace.name.toLocaleLowerCase().includes(term)) {
      results.push({
        type: 'palace',
        palaceId: palace.id,
        palaceName: palace.name,
        itemId: null,
        title: palace.name,
        subtitle: `${items.length} ${items.length === 1 ? 'memory' : 'memories'}`,
      });
    }

    for (const item of items) {
      if (!item || typeof item.id !== 'string') continue;
      const title = typeof item.title === 'string' ? item.title : '';
      const content = typeof item.content === 'string' ? item.content : '';
      if (!`${title}\n${content}`.toLocaleLowerCase().includes(term)) continue;

      const normalizedContent = content.replace(/\s+/g, ' ').trim();
      const excerpt = normalizedContent.length > 110
        ? `${normalizedContent.slice(0, 107).trimEnd()}…`
        : normalizedContent;
      results.push({
        type: 'marker',
        itemType: item.type,
        palaceId: palace.id,
        palaceName: palace.name,
        itemId: item.id,
        targetId: item.targetId,
        title: title || (item.type === 'gateway' ? 'Gateway' : 'Untitled memory'),
        excerpt,
      });
    }
  }

  return results.slice(0, 50);
}
