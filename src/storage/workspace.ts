import { migrateProjects, type Project } from '../domain/model';
import { recoverableSnapshots } from './recovery';

const DB_NAME = 'glyphind-local-first';
const DB_VERSION = 1;
const ACTIVE_KEY = 'active-workspace';
const LEGACY_KEY = 'glyphind-projects-v1';

type StoredWorkspace = { key: string; savedAt: number; projects: Project[] };
type StoredSnapshot = { id: string; savedAt: number; projects: Project[] };

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!canUseIndexedDb()) return reject(new Error('IndexedDB no disponible'));
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir IndexedDB'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('workspace')) db.createObjectStore('workspace', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function readLocalFallback(): Project[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    return raw ? migrateProjects(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export async function loadWorkspace(): Promise<{ projects: Project[]; recoveredFromSnapshot: boolean }> {
  const fallback = readLocalFallback();
  let db: IDBDatabase | undefined;
  let workspace: StoredWorkspace | undefined;
  let snapshots: StoredSnapshot[] = [];
  try {
    const openedDb = await openDb();
    db = openedDb;
    const result = await new Promise<{ workspace?: StoredWorkspace; snapshots: StoredSnapshot[] }>((resolve, reject) => {
      const transaction = openedDb.transaction(['workspace', 'snapshots'], 'readonly');
      const workspaceRequest = transaction.objectStore('workspace').get(ACTIVE_KEY);
      const snapshotsRequest = transaction.objectStore('snapshots').getAll();
      let workspaceResult: StoredWorkspace | undefined;
      let snapshotsResult: StoredSnapshot[] = [];
      workspaceRequest.onsuccess = () => { workspaceResult = workspaceRequest.result as StoredWorkspace | undefined; };
      snapshotsRequest.onsuccess = () => { snapshotsResult = snapshotsRequest.result as StoredSnapshot[]; };
      transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo leer el workspace'));
      transaction.oncomplete = () => resolve({ workspace: workspaceResult, snapshots: snapshotsResult });
    });
    workspace = result.workspace;
    snapshots = result.snapshots;
  } catch {
    // Se intenta fallback local incluso cuando el activo de IndexedDB falla.
  } finally {
    db?.close();
  }

  if (Array.isArray(workspace?.projects)) {
    try { return { projects: migrateProjects(workspace.projects), recoveredFromSnapshot: false }; } catch { /* busca un snapshot consistente */ }
  }
  for (const snapshot of recoverableSnapshots<Project>(snapshots)) {
    try { return { projects: migrateProjects(snapshot.projects), recoveredFromSnapshot: true }; } catch { /* sigue con el siguiente snapshot */ }
  }
  return { projects: fallback, recoveredFromSnapshot: false };
}

export async function persistWorkspace(projects: Project[]): Promise<'indexeddb' | 'localStorage'> {
  const normalized = migrateProjects(projects);
  try {
    window.localStorage.setItem(LEGACY_KEY, JSON.stringify(normalized));
  } catch {
    // IndexedDB puede seguir teniendo espacio aunque localStorage esté lleno.
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const savedAt = Date.now();
      const snapshot: StoredSnapshot = { id: `snapshot-${savedAt}-${Math.random().toString(36).slice(2, 7)}`, savedAt, projects: normalized };
      const transaction = db.transaction(['workspace', 'snapshots'], 'readwrite');
      transaction.objectStore('snapshots').put(snapshot);
      transaction.objectStore('workspace').put({ key: ACTIVE_KEY, savedAt, projects: normalized } satisfies StoredWorkspace);
      transaction.onerror = () => reject(transaction.error ?? new Error('No se pudo escribir el snapshot'));
      transaction.oncomplete = () => resolve();
    });
    await trimSnapshots(db);
    db.close();
    return 'indexeddb';
  } catch {
    return 'localStorage';
  }
}

async function trimSnapshots(db: IDBDatabase) {
  try {
    const snapshots = await new Promise<StoredSnapshot[]>((resolve, reject) => {
      const request = db.transaction('snapshots', 'readonly').objectStore('snapshots').getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result as StoredSnapshot[]);
    });
    const old = snapshots.sort((a, b) => b.savedAt - a.savedAt).slice(8);
    if (!old.length) return;
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('snapshots', 'readwrite');
      old.forEach((snapshot) => transaction.objectStore('snapshots').delete(snapshot.id));
      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve();
    });
  } catch {
    // La poda es una optimización; nunca debe impedir guardar.
  }
}

export function legacyStorageKey() {
  return LEGACY_KEY;
}
