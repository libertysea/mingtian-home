import type { StoredTrack, Track } from './types';

export const metingBases = [
  'https://api.injahow.cn/meting/',
  'https://api.qijieya.cn/meting/'
];

export function resolveAsset(path: string) {
  const normalized = path.replace(/^\/+/, '');
  if (typeof document === 'undefined') return `/${normalized}`;
  const mapped = typeof window === 'undefined' ? null : window.MusicAssets?.[normalized];
  if (mapped) return mapped;
  return new URL(normalized, document.baseURI).href;
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function normalizeMetingSource(url: string, baseIndex = 0) {
  if (!url) return '';
  try {
    const parsed = new URL(url, window.location.href);
    if (/injahow|qijieya/i.test(parsed.hostname)) {
      return `${metingBases[baseIndex]}${parsed.search}`;
    }
    return parsed.href;
  } catch {
    return url;
  }
}

export function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The page remains usable when storage is blocked.
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Local library is not supported in this browser.'));
      return;
    }
    const request = indexedDB.open('music-local-react', 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains('tracks')) {
        database.createObjectStore('tracks', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Unable to open the local library.'));
  });
}

async function databaseRequest<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T>
) {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction('tracks', mode);
    const request = callback(transaction.objectStore('tracks'));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Local library operation failed.'));
    transaction.oncomplete = () => database.close();
  });
}

export async function loadLocalTracks() {
  const records = await databaseRequest<StoredTrack[]>('readonly', store => store.getAll());
  return records
    .sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0))
    .map(record => ({
      ...record,
      audio: URL.createObjectURL(record.blob),
      blob: undefined
    } as Track));
}

export async function saveLocalTrack(record: StoredTrack) {
  await databaseRequest<IDBValidKey>('readwrite', store => store.put(record));
}

function readTextFrame(bytes: Uint8Array) {
  if (!bytes.length) return '';
  const encoding = bytes[0];
  const content = bytes.slice(1);
  try {
    if (encoding === 3) return new TextDecoder('utf-8').decode(content).replace(/\0+$/g, '');
    if (encoding === 1 || encoding === 2) return new TextDecoder('utf-16').decode(content).replace(/\0+$/g, '');
    return new TextDecoder('iso-8859-1').decode(content).replace(/\0+$/g, '');
  } catch {
    return '';
  }
}

function syncSafeInteger(bytes: Uint8Array) {
  return ((bytes[0] & 127) << 21) | ((bytes[1] & 127) << 14) | ((bytes[2] & 127) << 7) | (bytes[3] & 127);
}

function normalInteger(bytes: Uint8Array) {
  return ((bytes[0] << 24) >>> 0) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3];
}

function findTerminator(bytes: Uint8Array, offset: number, doubleByte: boolean) {
  if (doubleByte) {
    for (let index = offset; index + 1 < bytes.length; index += 2) {
      if (bytes[index] === 0 && bytes[index + 1] === 0) return index + 2;
    }
    return bytes.length;
  }
  const index = bytes.indexOf(0, offset);
  return index < 0 ? bytes.length : index + 1;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function readAudioMetadata(file: File) {
  const metadata = {
    title: file.name.replace(/\.[^.]+$/, ''),
    artist: '',
    cover: ''
  };
  if (!/\.mp3$/i.test(file.name)) return metadata;

  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 4 * 1024 * 1024)).arrayBuffer());
  if (String.fromCharCode(...bytes.slice(0, 3)) !== 'ID3') return metadata;

  const version = bytes[3];
  const tagSize = syncSafeInteger(bytes.slice(6, 10));
  let offset = 10;
  const end = Math.min(bytes.length, 10 + tagSize);

  while (offset + 10 <= end) {
    const frameId = String.fromCharCode(...bytes.slice(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break;
    const frameSize = version === 4
      ? syncSafeInteger(bytes.slice(offset + 4, offset + 8))
      : normalInteger(bytes.slice(offset + 4, offset + 8));
    if (!frameSize || offset + 10 + frameSize > end) break;

    const frame = bytes.slice(offset + 10, offset + 10 + frameSize);
    if (frameId === 'TIT2') metadata.title = readTextFrame(frame) || metadata.title;
    if (frameId === 'TPE1') metadata.artist = readTextFrame(frame);
    if (frameId === 'APIC' && frame.length > 8) {
      const encoding = frame[0];
      const mimeEnd = frame.indexOf(0, 1);
      if (mimeEnd > 1) {
        const mime = new TextDecoder('iso-8859-1').decode(frame.slice(1, mimeEnd));
        const descriptionStart = mimeEnd + 2;
        const imageStart = findTerminator(frame, descriptionStart, encoding === 1 || encoding === 2);
        if (imageStart < frame.length) {
          metadata.cover = await blobToDataUrl(new Blob([frame.slice(imageStart)], { type: mime || 'image/jpeg' }));
        }
      }
    }
    offset += 10 + frameSize;
  }

  return metadata;
}
