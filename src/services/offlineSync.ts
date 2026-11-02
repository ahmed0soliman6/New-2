import { supabase, clinicId } from './supabase';

export interface CachedRow {
  id: string;
  data: Record<string, unknown>;
  updated_at?: string;
}

interface StoredRecord {
  key: string;
  clinic_id: string;
  table: string;
  id: string;
  data: Record<string, unknown>;
  updated_at: string;
}

interface SyncMetaRecord {
  metaKey: string;
  lastSyncedAt: string;
}

interface OutboxMutation {
  mutationId: string;
  clinic_id: string;
  table: string;
  id: string;
  op: 'upsert' | 'delete';
  data?: Record<string, unknown>;
  updated_at: string;
  createdAt: number;
}

const DB_NAME = 'soli_clinic_offline_db';
const DB_VERSION = 1;
const STORE_RECORDS = 'records';
const STORE_META = 'sync_meta';
const STORE_OUTBOX = 'outbox';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memoryFallback = new Map<string, StoredRecord>();
const memoryMetaFallback = new Map<string, string>();
const memoryOutboxFallback: OutboxMutation[] = [];

function openOfflineDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_RECORDS)) {
          const store = db.createObjectStore(STORE_RECORDS, { keyPath: 'key' });
          store.createIndex('by_clinic_table', ['clinic_id', 'table'], { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: 'metaKey' });
        }
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
          db.createObjectStore(STORE_OUTBOX, { keyPath: 'mutationId' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

function makeRecordKey(table: string, id: string): string {
  return `${clinicId}:${table}:${id}`;
}

function makeMetaKey(table: string): string {
  return `${clinicId}:${table}`;
}

export async function getCachedTableRows(table: string): Promise<CachedRow[]> {
  const db = await openOfflineDb();
  if (!db) {
    const prefix = `${clinicId}:${table}:`;
    const rows: CachedRow[] = [];
    for (const [k, v] of memoryFallback.entries()) {
      if (k.startsWith(prefix)) {
        rows.push({ id: v.id, data: v.data, updated_at: v.updated_at });
      }
    }
    return rows;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_RECORDS, 'readonly');
      const store = tx.objectStore(STORE_RECORDS);
      const index = store.index('by_clinic_table');
      const req = index.getAll(IDBKeyRange.only([clinicId, table]));
      req.onsuccess = () => {
        const items = (req.result || []) as StoredRecord[];
        resolve(items.map((r) => ({ id: r.id, data: r.data, updated_at: r.updated_at })));
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function putCachedTableRows(table: string, rows: CachedRow[]): Promise<void> {
  if (!rows.length) return;
  const nowIso = new Date().toISOString();
  const db = await openOfflineDb();

  if (!db) {
    for (const row of rows) {
      const key = makeRecordKey(table, row.id);
      memoryFallback.set(key, {
        key,
        clinic_id: clinicId,
        table,
        id: row.id,
        data: row.data,
        updated_at: row.updated_at || nowIso,
      });
    }
    return;
  }

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_RECORDS, 'readwrite');
      const store = tx.objectStore(STORE_RECORDS);
      for (const row of rows) {
        const key = makeRecordKey(table, row.id);
        store.put({
          key,
          clinic_id: clinicId,
          table,
          id: row.id,
          data: row.data,
          updated_at: row.updated_at || nowIso,
        } satisfies StoredRecord);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function replaceCachedTableRows(table: string, rows: CachedRow[]): Promise<void> {
  const nowIso = new Date().toISOString();
  const db = await openOfflineDb();

  if (!db) {
    const prefix = `${clinicId}:${table}:`;
    for (const key of Array.from(memoryFallback.keys())) {
      if (key.startsWith(prefix)) memoryFallback.delete(key);
    }
    for (const row of rows) {
      const key = makeRecordKey(table, row.id);
      memoryFallback.set(key, {
        key,
        clinic_id: clinicId,
        table,
        id: row.id,
        data: row.data,
        updated_at: row.updated_at || nowIso,
      });
    }
    return;
  }

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_RECORDS, 'readwrite');
      const store = tx.objectStore(STORE_RECORDS);
      const index = store.index('by_clinic_table');
      const keyReq = index.getAllKeys(IDBKeyRange.only([clinicId, table]));
      keyReq.onsuccess = () => {
        const existingKeys = (keyReq.result || []) as IDBValidKey[];
        const incomingKeys = new Set(rows.map((r) => makeRecordKey(table, r.id)));
        for (const k of existingKeys) {
          if (!incomingKeys.has(String(k))) {
            store.delete(k);
          }
        }
        for (const row of rows) {
          const key = makeRecordKey(table, row.id);
          store.put({
            key,
            clinic_id: clinicId,
            table,
            id: row.id,
            data: row.data,
            updated_at: row.updated_at || nowIso,
          } satisfies StoredRecord);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function deleteCachedTableRow(table: string, id: string): Promise<void> {
  const key = makeRecordKey(table, id);
  memoryFallback.delete(key);
  const db = await openOfflineDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_RECORDS, 'readwrite');
      tx.objectStore(STORE_RECORDS).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearCachedTables(tables: string[]): Promise<void> {
  const db = await openOfflineDb();
  for (const table of tables) {
    const metaKey = makeMetaKey(table);
    memoryMetaFallback.delete(metaKey);
    const prefix = `${clinicId}:${table}:`;
    for (const k of Array.from(memoryFallback.keys())) {
      if (k.startsWith(prefix)) memoryFallback.delete(k);
    }
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction([STORE_RECORDS, STORE_META], 'readwrite');
          const store = tx.objectStore(STORE_RECORDS);
          const index = store.index('by_clinic_table');
          const req = index.openKeyCursor(IDBKeyRange.only([clinicId, table]));
          req.onsuccess = () => {
            const cursor = req.result;
            if (cursor) {
              store.delete(cursor.primaryKey);
              cursor.continue();
            }
          };
          tx.objectStore(STORE_META).delete(metaKey);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
  }
}

async function getLastSyncedAt(table: string): Promise<string | null> {
  const metaKey = makeMetaKey(table);
  const db = await openOfflineDb();
  if (!db) return memoryMetaFallback.get(metaKey) || null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get(metaKey);
      req.onsuccess = () => {
        const rec = req.result as SyncMetaRecord | undefined;
        resolve(rec?.lastSyncedAt || null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function setLastSyncedAt(table: string, lastSyncedAt: string): Promise<void> {
  const metaKey = makeMetaKey(table);
  memoryMetaFallback.set(metaKey, lastSyncedAt);
  const db = await openOfflineDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ metaKey, lastSyncedAt } satisfies SyncMetaRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function enqueueOfflineMutation(
  op: 'upsert' | 'delete',
  table: string,
  id: string,
  data?: Record<string, unknown>,
  updatedAt?: string
): Promise<void> {
  const mutation: OutboxMutation = {
    mutationId: `${clinicId}:${table}:${id}:${Date.now()}`,
    clinic_id: clinicId,
    table,
    id,
    op,
    data,
    updated_at: updatedAt || new Date().toISOString(),
    createdAt: Date.now(),
  };

  const db = await openOfflineDb();
  if (!db) {
    memoryOutboxFallback.push(mutation);
    return;
  }

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_OUTBOX, 'readwrite');
      tx.objectStore(STORE_OUTBOX).put(mutation);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

interface RecentLocalWrite {
  data: Record<string, unknown>;
  updated_at: string;
  expiresAt: number;
}

const recentLocalWrites = new Map<string, RecentLocalWrite>();

export function markLocalWrite(
  table: string,
  id: string,
  data: Record<string, unknown>,
  updatedAt?: string,
  ttlMs = 6000
): void {
  const key = makeRecordKey(table, id);
  recentLocalWrites.set(key, {
    data,
    updated_at: updatedAt || new Date().toISOString(),
    expiresAt: Date.now() + ttlMs,
  });
}

export function hasRecentLocalWrite(table: string, id?: string): boolean {
  const now = Date.now();
  if (id) {
    const key = makeRecordKey(table, id);
    const entry = recentLocalWrites.get(key);
    if (!entry) return false;
    if (entry.expiresAt <= now) {
      recentLocalWrites.delete(key);
      return false;
    }
    return true;
  }
  const prefix = `${clinicId}:${table}:`;
  for (const [k, v] of recentLocalWrites.entries()) {
    if (v.expiresAt <= now) {
      recentLocalWrites.delete(k);
      continue;
    }
    if (k.startsWith(prefix)) return true;
  }
  return false;
}

function applyRecentLocalWrites(table: string, fetched: CachedRow[]): CachedRow[] {
  const now = Date.now();
  const prefix = `${clinicId}:${table}:`;
  const byId = new Map<string, CachedRow>();
  for (const r of fetched) {
    byId.set(r.id, r);
  }
  for (const [key, entry] of recentLocalWrites.entries()) {
    if (entry.expiresAt <= now) {
      recentLocalWrites.delete(key);
      continue;
    }
    if (key.startsWith(prefix)) {
      const rowId = key.slice(prefix.length);
      byId.set(rowId, {
        id: rowId,
        data: entry.data,
        updated_at: entry.updated_at,
      });
    }
  }
  return Array.from(byId.values());
}

let isFlushingOutbox = false;

export async function flushOfflineOutbox(): Promise<void> {
  if (isFlushingOutbox || !supabase) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  isFlushingOutbox = true;
  try {
    const db = await openOfflineDb();
    let mutations: OutboxMutation[] = [];

    if (!db) {
      mutations = [...memoryOutboxFallback];
    } else {
      mutations = await new Promise<OutboxMutation[]>((resolve) => {
        try {
          const tx = db.transaction(STORE_OUTBOX, 'readonly');
          const req = tx.objectStore(STORE_OUTBOX).getAll();
          req.onsuccess = () => resolve((req.result || []) as OutboxMutation[]);
          req.onerror = () => resolve([]);
        } catch {
          resolve([]);
        }
      });
    }

    const clinicMutations = mutations
      .filter((m) => m.clinic_id === clinicId)
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const m of clinicMutations) {
      let succeeded = false;
      if (m.op === 'upsert' && m.data) {
        const { error } = await supabase.from(m.table).upsert(
          {
            clinic_id: clinicId,
            id: m.id,
            data: m.data,
          },
          { onConflict: 'clinic_id,id' }
        );
        if (!error) succeeded = true;
      } else if (m.op === 'delete') {
        const { error } = await supabase
          .from(m.table)
          .delete()
          .eq('clinic_id', clinicId)
          .eq('id', m.id);
        if (!error) succeeded = true;
      }

      if (succeeded) {
        if (!db) {
          const idx = memoryOutboxFallback.findIndex((x) => x.mutationId === m.mutationId);
          if (idx >= 0) memoryOutboxFallback.splice(idx, 1);
        } else {
          await new Promise<void>((resolve) => {
            try {
              const tx = db.transaction(STORE_OUTBOX, 'readwrite');
              tx.objectStore(STORE_OUTBOX).delete(m.mutationId);
              tx.oncomplete = () => resolve();
              tx.onerror = () => resolve();
            } catch {
              resolve();
            }
          });
        }
      }
    }
  } finally {
    isFlushingOutbox = false;
  }
}

export async function syncTableIncremental(
  table: string,
  _forceFull = false
): Promise<{ rows: CachedRow[]; error: Error | null }> {
  const cached = await getCachedTableRows(table);

  if (!supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return { rows: applyRecentLocalWrites(table, cached), error: null };
  }

  await flushOfflineOutbox();

  const { data, error } = await supabase
    .from(table)
    .select('id, data, updated_at')
    .eq('clinic_id', clinicId);

  if (error) {
    return { rows: applyRecentLocalWrites(table, cached), error: new Error(error.message) };
  }

  const fetched = applyRecentLocalWrites(table, (data || []) as CachedRow[]);
  await replaceCachedTableRows(table, fetched);

  let maxTs = new Date(0).toISOString();
  for (const r of fetched) {
    if (r.updated_at && r.updated_at > maxTs) {
      maxTs = r.updated_at;
    }
  }
  if (fetched.length > 0) {
    await setLastSyncedAt(table, maxTs);
  }
  return { rows: fetched, error: null };
}

export function notifyTableMutated(tables: string | string[], forceFull = false): void {
  if (typeof window === 'undefined') return;
  const list = Array.isArray(tables) ? tables : [tables];
  window.dispatchEvent(
    new CustomEvent('soli_supabase_mutated', {
      detail: { tables: list, forceFull },
    })
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushOfflineOutbox().then(() => {
      notifyTableMutated(['*'], false);
    });
  });
}
