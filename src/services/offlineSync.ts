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
  _rev: number;
}

interface SyncMetaRecord {
  metaKey: string;
  lastSyncedAt: string;
}

export interface OutboxMutation {
  mutationId: string;
  clinic_id: string;
  table: string;
  id: string;
  op: 'upsert' | 'delete';
  data?: Record<string, unknown>;
  baseRev: number;
  nextRev: number;
  updated_at: string;
  createdAt: number;
}

export interface TombstoneRecord {
  key: string;
  clinic_id: string;
  table: string;
  id: string;
  deletedAt: string;
  _rev: number;
}

export interface SyncConflictItem {
  conflictId: string;
  clinic_id: string;
  table: string;
  id: string;
  localData: Record<string, unknown>;
  serverData: Record<string, unknown>;
  localRev: number;
  serverRev: number;
  localUpdatedAt: string;
  serverUpdatedAt: string;
  detectedAt: string;
}

const DB_NAME = 'soli_clinic_offline_db';
const DB_VERSION = 2;
const STORE_RECORDS = 'records';
const STORE_META = 'sync_meta';
const STORE_OUTBOX = 'outbox';
const STORE_TOMBSTONES = 'tombstones';
const STORE_CONFLICTS = 'conflicts';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memoryFallback = new Map<string, StoredRecord>();
const memoryMetaFallback = new Map<string, string>();
const memoryOutboxFallback = new Map<string, OutboxMutation>();
const memoryTombstonesFallback = new Map<string, TombstoneRecord>();
const memoryConflictsFallback = new Map<string, SyncConflictItem>();

export function getRecordRev(data?: Record<string, unknown> | null): number {
  if (!data || typeof data !== 'object') return 0;
  const rev = Number((data as Record<string, unknown>)._rev);
  return Number.isFinite(rev) && rev >= 0 ? Math.floor(rev) : 0;
}

export function withIncrementedRev(
  data: Record<string, unknown>,
  baseRev?: number
): { dataWithRev: Record<string, unknown>; baseRev: number; nextRev: number } {
  const currentRev = typeof baseRev === 'number' && Number.isFinite(baseRev) ? baseRev : getRecordRev(data);
  const nextRev = currentRev + 1;
  return {
    dataWithRev: {
      ...data,
      _rev: nextRev,
    },
    baseRev: currentRev,
    nextRev,
  };
}

export function buildDeterministicMutationId(
  targetClinicId: string,
  table: string,
  id: string,
  op: 'upsert' | 'delete',
  baseRev: number
): string {
  return `${targetClinicId}:${table}:${id}:${op}:r${baseRev}`;
}

export function detectRevisionConflict(params: {
  baseRev: number;
  localData: Record<string, unknown>;
  serverData?: Record<string, unknown> | null;
  serverUpdatedAt?: string;
  localUpdatedAt?: string;
}): boolean {
  const { baseRev, localData, serverData } = params;
  if (!serverData) return false;
  const serverRev = getRecordRev(serverData);

  // If server has advanced beyond baseRev that the local edit started from,
  // check if payload actually differs (ignoring metadata timestamps/_rev)
  if (serverRev > baseRev) {
    const cleanLocal = { ...localData };
    const cleanServer = { ...serverData };
    delete cleanLocal._rev;
    delete cleanLocal.updatedAt;
    delete cleanServer._rev;
    delete cleanServer.updatedAt;
    return JSON.stringify(cleanLocal) !== JSON.stringify(cleanServer);
  }
  return false;
}

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
        if (!db.objectStoreNames.contains(STORE_TOMBSTONES)) {
          const tsStore = db.createObjectStore(STORE_TOMBSTONES, { keyPath: 'key' });
          tsStore.createIndex('by_clinic_table', ['clinic_id', 'table'], { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_CONFLICTS)) {
          db.createObjectStore(STORE_CONFLICTS, { keyPath: 'conflictId' });
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

function dispatchConflictsUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('soli_sync_conflict_updated'));
  }
}

export async function markTombstone(
  table: string,
  id: string,
  deletedAt = new Date().toISOString(),
  rev = 1
): Promise<void> {
  const key = makeRecordKey(table, id);
  const record: TombstoneRecord = {
    key,
    clinic_id: clinicId,
    table,
    id,
    deletedAt,
    _rev: rev,
  };
  memoryTombstonesFallback.set(key, record);
  memoryFallback.delete(key);

  const db = await openOfflineDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction([STORE_TOMBSTONES, STORE_RECORDS], 'readwrite');
      tx.objectStore(STORE_TOMBSTONES).put(record);
      tx.objectStore(STORE_RECORDS).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function clearTombstone(table: string, id: string): Promise<void> {
  const key = makeRecordKey(table, id);
  memoryTombstonesFallback.delete(key);
  const db = await openOfflineDb();
  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_TOMBSTONES, 'readwrite');
      tx.objectStore(STORE_TOMBSTONES).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function getTombstoneIdsForTable(table: string): Promise<Set<string>> {
  const ids = new Set<string>();
  const prefix = `${clinicId}:${table}:`;
  for (const [k, v] of memoryTombstonesFallback.entries()) {
    if (k.startsWith(prefix)) ids.add(v.id);
  }

  const db = await openOfflineDb();
  if (!db) return ids;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_TOMBSTONES, 'readonly');
      const store = tx.objectStore(STORE_TOMBSTONES);
      const index = store.index('by_clinic_table');
      const req = index.getAll(IDBKeyRange.only([clinicId, table]));
      req.onsuccess = () => {
        const items = (req.result || []) as TombstoneRecord[];
        for (const item of items) {
          ids.add(item.id);
        }
        resolve(ids);
      };
      req.onerror = () => resolve(ids);
    } catch {
      resolve(ids);
    }
  });
}

export async function isTombstoned(table: string, id: string): Promise<boolean> {
  const set = await getTombstoneIdsForTable(table);
  return set.has(id);
}

export async function getCachedTableRows(table: string): Promise<CachedRow[]> {
  const tombstoneIds = await getTombstoneIdsForTable(table);
  const db = await openOfflineDb();
  if (!db) {
    const prefix = `${clinicId}:${table}:`;
    const rows: CachedRow[] = [];
    for (const [k, v] of memoryFallback.entries()) {
      if (k.startsWith(prefix) && !tombstoneIds.has(v.id)) {
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
        resolve(
          items
            .filter((r) => !tombstoneIds.has(r.id))
            .map((r) => ({ id: r.id, data: r.data, updated_at: r.updated_at }))
        );
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
  const tombstoneIds = await getTombstoneIdsForTable(table);
  const db = await openOfflineDb();

  const validRows = rows.filter((r) => !tombstoneIds.has(r.id));
  if (!validRows.length) return;

  for (const row of validRows) {
    const key = makeRecordKey(table, row.id);
    const rev = getRecordRev(row.data) || 1;
    const dataWithRev = { ...row.data, _rev: rev };
    memoryFallback.set(key, {
      key,
      clinic_id: clinicId,
      table,
      id: row.id,
      data: dataWithRev,
      updated_at: row.updated_at || nowIso,
      _rev: rev,
    });
  }

  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_RECORDS, 'readwrite');
      const store = tx.objectStore(STORE_RECORDS);
      for (const row of validRows) {
        const key = makeRecordKey(table, row.id);
        const rev = getRecordRev(row.data) || 1;
        store.put({
          key,
          clinic_id: clinicId,
          table,
          id: row.id,
          data: { ...row.data, _rev: rev },
          updated_at: row.updated_at || nowIso,
          _rev: rev,
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
  const tombstoneIds = await getTombstoneIdsForTable(table);
  const validRows = rows.filter((r) => !tombstoneIds.has(r.id));
  const db = await openOfflineDb();

  const prefix = `${clinicId}:${table}:`;
  for (const key of Array.from(memoryFallback.keys())) {
    if (key.startsWith(prefix)) memoryFallback.delete(key);
  }
  for (const row of validRows) {
    const key = makeRecordKey(table, row.id);
    const rev = getRecordRev(row.data) || 1;
    memoryFallback.set(key, {
      key,
      clinic_id: clinicId,
      table,
      id: row.id,
      data: { ...row.data, _rev: rev },
      updated_at: row.updated_at || nowIso,
      _rev: rev,
    });
  }

  if (!db) return;

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_RECORDS, 'readwrite');
      const store = tx.objectStore(STORE_RECORDS);
      const index = store.index('by_clinic_table');
      const keyReq = index.getAllKeys(IDBKeyRange.only([clinicId, table]));
      keyReq.onsuccess = () => {
        const existingKeys = (keyReq.result || []) as IDBValidKey[];
        const incomingKeys = new Set(validRows.map((r) => makeRecordKey(table, r.id)));
        for (const k of existingKeys) {
          if (!incomingKeys.has(String(k))) {
            store.delete(k);
          }
        }
        for (const row of validRows) {
          const key = makeRecordKey(table, row.id);
          const rev = getRecordRev(row.data) || 1;
          store.put({
            key,
            clinic_id: clinicId,
            table,
            id: row.id,
            data: { ...row.data, _rev: rev },
            updated_at: row.updated_at || nowIso,
            _rev: rev,
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
  const existing = memoryFallback.get(key);
  const nextRev = (existing?._rev || 1) + 1;
  await markTombstone(table, id, new Date().toISOString(), nextRev);
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
    for (const k of Array.from(memoryTombstonesFallback.keys())) {
      if (k.startsWith(prefix)) memoryTombstonesFallback.delete(k);
    }
    if (db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = db.transaction([STORE_RECORDS, STORE_META, STORE_TOMBSTONES], 'readwrite');
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
          const tsStore = tx.objectStore(STORE_TOMBSTONES);
          const tsIndex = tsStore.index('by_clinic_table');
          const tsReq = tsIndex.openKeyCursor(IDBKeyRange.only([clinicId, table]));
          tsReq.onsuccess = () => {
            const cursor = tsReq.result;
            if (cursor) {
              tsStore.delete(cursor.primaryKey);
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

export async function getLastSyncedAt(table: string): Promise<string | null> {
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

export async function setLastSyncedAt(table: string, lastSyncedAt: string): Promise<void> {
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
): Promise<OutboxMutation> {
  const key = makeRecordKey(table, id);
  const cachedRecord = memoryFallback.get(key);
  const baseRev = data ? getRecordRev(data) || cachedRecord?._rev || 0 : cachedRecord?._rev || 0;
  const nextRev = baseRev + 1;
  const nowIso = updatedAt || new Date().toISOString();

  // Deterministic mutationId prevents duplicate operations on retry
  const mutationId = buildDeterministicMutationId(clinicId, table, id, op, baseRev);

  const enrichedData =
    op === 'upsert' && data
      ? {
          ...data,
          _rev: nextRev,
          updatedAt: nowIso,
        }
      : undefined;

  if (op === 'delete') {
    await markTombstone(table, id, nowIso, nextRev);
  } else if (enrichedData) {
    await clearTombstone(table, id);
  }

  const mutation: OutboxMutation = {
    mutationId,
    clinic_id: clinicId,
    table,
    id,
    op,
    data: enrichedData,
    baseRev,
    nextRev,
    updated_at: nowIso,
    createdAt: Date.now(),
  };

  // Deduplicate any older pending mutation for the same (clinic_id, table, id)
  for (const [existingKey, existingMut] of Array.from(memoryOutboxFallback.entries())) {
    if (
      existingMut.clinic_id === clinicId &&
      existingMut.table === table &&
      existingMut.id === id &&
      existingKey !== mutationId
    ) {
      memoryOutboxFallback.delete(existingKey);
    }
  }
  memoryOutboxFallback.set(mutationId, mutation);

  const db = await openOfflineDb();
  if (!db) {
    return mutation;
  }

  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_OUTBOX, 'readwrite');
      const store = tx.objectStore(STORE_OUTBOX);
      const getAllReq = store.getAll();
      getAllReq.onsuccess = () => {
        const all = (getAllReq.result || []) as OutboxMutation[];
        for (const item of all) {
          if (
            item.clinic_id === clinicId &&
            item.table === table &&
            item.id === id &&
            item.mutationId !== mutationId
          ) {
            store.delete(item.mutationId);
          }
        }
        store.put(mutation);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });

  return mutation;
}

export async function getOutboxMutations(): Promise<OutboxMutation[]> {
  const db = await openOfflineDb();
  if (!db) {
    return Array.from(memoryOutboxFallback.values()).filter((m) => m.clinic_id === clinicId);
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_OUTBOX, 'readonly');
      const req = tx.objectStore(STORE_OUTBOX).getAll();
      req.onsuccess = () => {
        const list = ((req.result || []) as OutboxMutation[]).filter((m) => m.clinic_id === clinicId);
        resolve(list);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

// =============================================================================
// Conflict Store & Side-by-Side Comparison Resolution
// =============================================================================

export async function recordSyncConflict(conflict: SyncConflictItem): Promise<void> {
  memoryConflictsFallback.set(conflict.conflictId, conflict);
  const db = await openOfflineDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_CONFLICTS, 'readwrite');
        tx.objectStore(STORE_CONFLICTS).put(conflict);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
  dispatchConflictsUpdated();
}

export async function getPendingConflicts(): Promise<SyncConflictItem[]> {
  const db = await openOfflineDb();
  if (!db) {
    return Array.from(memoryConflictsFallback.values()).filter((c) => c.clinic_id === clinicId);
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_CONFLICTS, 'readonly');
      const req = tx.objectStore(STORE_CONFLICTS).getAll();
      req.onsuccess = () => {
        const items = ((req.result || []) as SyncConflictItem[]).filter(
          (c) => c.clinic_id === clinicId
        );
        resolve(items);
      };
      req.onerror = () => resolve(Array.from(memoryConflictsFallback.values()));
    } catch {
      resolve(Array.from(memoryConflictsFallback.values()));
    }
  });
}

export async function resolveSyncConflict(
  conflictId: string,
  resolution: 'keep_local' | 'keep_server',
  customMergedData?: Record<string, unknown>
): Promise<void> {
  const conflicts = await getPendingConflicts();
  const target = conflicts.find((c) => c.conflictId === conflictId) || memoryConflictsFallback.get(conflictId);
  if (!target) return;

  const winningRev = Math.max(target.localRev, target.serverRev) + 1;
  const nowIso = new Date().toISOString();
  const chosenBase =
    customMergedData || (resolution === 'keep_local' ? target.localData : target.serverData);
  const resolvedPayload: Record<string, unknown> = {
    ...chosenBase,
    _rev: winningRev,
    updatedAt: nowIso,
  };

  if (supabase && (typeof navigator === 'undefined' || navigator.onLine !== false)) {
    await supabase.from(target.table).upsert(
      {
        clinic_id: target.clinic_id,
        id: target.id,
        data: resolvedPayload,
      },
      { onConflict: 'clinic_id,id' }
    );
  }

  await putCachedTableRows(target.table, [
    {
      id: target.id,
      data: resolvedPayload,
      updated_at: nowIso,
    },
  ]);

  memoryConflictsFallback.delete(conflictId);
  const db = await openOfflineDb();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_CONFLICTS, 'readwrite');
        tx.objectStore(STORE_CONFLICTS).delete(conflictId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  dispatchConflictsUpdated();
  notifyTableMutated([target.table], false);
}

// =============================================================================
// Local Write Tracking (Revision-backed, not relying on 6000ms timer for OCC)
// =============================================================================

interface PendingLocalWrite {
  data: Record<string, unknown>;
  updated_at: string;
  _rev: number;
}

const pendingLocalWrites = new Map<string, PendingLocalWrite>();

export function markLocalWrite(
  table: string,
  id: string,
  data: Record<string, unknown>,
  updatedAt?: string
): void {
  const key = makeRecordKey(table, id);
  const currentRev = getRecordRev(data) || (pendingLocalWrites.get(key)?._rev ?? 0) + 1;
  const nowIso = updatedAt || new Date().toISOString();
  const dataWithRev = { ...data, _rev: currentRev };
  pendingLocalWrites.set(key, {
    data: dataWithRev,
    updated_at: nowIso,
    _rev: currentRev,
  });
}

export function clearLocalWriteMark(table: string, id: string): void {
  pendingLocalWrites.delete(makeRecordKey(table, id));
}

export function hasRecentLocalWrite(table: string, id?: string): boolean {
  if (id) {
    return pendingLocalWrites.has(makeRecordKey(table, id));
  }
  const prefix = `${clinicId}:${table}:`;
  for (const k of pendingLocalWrites.keys()) {
    if (k.startsWith(prefix)) return true;
  }
  return false;
}

async function mergeFetchedRowsWithLocalState(
  table: string,
  fetched: CachedRow[],
  existingCached: CachedRow[],
  isIncremental: boolean
): Promise<CachedRow[]> {
  const tombstoneIds = await getTombstoneIdsForTable(table);
  const outbox = await getOutboxMutations();
  const outboxForTable = new Map<string, OutboxMutation>();
  for (const m of outbox) {
    if (m.table === table) {
      outboxForTable.set(m.id, m);
    }
  }

  const byId = new Map<string, CachedRow>();

  // If incremental sync, start with existing cached rows
  if (isIncremental) {
    for (const row of existingCached) {
      if (!tombstoneIds.has(row.id)) {
        byId.set(row.id, row);
      }
    }
  }

  for (const serverRow of fetched) {
    if (tombstoneIds.has(serverRow.id)) {
      // Never resurrect a tombstoned record
      byId.delete(serverRow.id);
      continue;
    }

    const pendingMut = outboxForTable.get(serverRow.id);
    if (pendingMut && pendingMut.op === 'delete') {
      byId.delete(serverRow.id);
      continue;
    }

    if (pendingMut && pendingMut.op === 'upsert' && pendingMut.data) {
      const hasConflict = detectRevisionConflict({
        baseRev: pendingMut.baseRev,
        localData: pendingMut.data,
        serverData: serverRow.data,
        serverUpdatedAt: serverRow.updated_at,
        localUpdatedAt: pendingMut.updated_at,
      });

      if (hasConflict) {
        await recordSyncConflict({
          conflictId: `${clinicId}:${table}:${serverRow.id}`,
          clinic_id: clinicId,
          table,
          id: serverRow.id,
          localData: pendingMut.data,
          serverData: serverRow.data,
          localRev: pendingMut.nextRev,
          serverRev: getRecordRev(serverRow.data),
          localUpdatedAt: pendingMut.updated_at,
          serverUpdatedAt: serverRow.updated_at || new Date().toISOString(),
          detectedAt: new Date().toISOString(),
        });
      }
      // Keep local pending version visible until conflict is resolved or outbox is flushed
      byId.set(serverRow.id, {
        id: serverRow.id,
        data: pendingMut.data,
        updated_at: pendingMut.updated_at,
      });
      continue;
    }

    const localMarkKey = makeRecordKey(table, serverRow.id);
    const localMark = pendingLocalWrites.get(localMarkKey);
    if (localMark) {
      const serverRev = getRecordRev(serverRow.data);
      if (serverRev >= localMark._rev) {
        // Server has caught up with or superseded local write
        pendingLocalWrites.delete(localMarkKey);
        byId.set(serverRow.id, serverRow);
      } else {
        byId.set(serverRow.id, {
          id: serverRow.id,
          data: localMark.data,
          updated_at: localMark.updated_at,
        });
      }
      continue;
    }

    byId.set(serverRow.id, serverRow);
  }

  // Ensure any offline-created records in outbox not yet on server remain in view
  for (const [id, mut] of outboxForTable.entries()) {
    if (mut.op === 'upsert' && mut.data && !tombstoneIds.has(id) && !byId.has(id)) {
      byId.set(id, {
        id,
        data: mut.data,
        updated_at: mut.updated_at,
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
    const mutations = await getOutboxMutations();
    const sorted = mutations.sort((a, b) => a.createdAt - b.createdAt);

    for (const m of sorted) {
      let succeeded = false;
      if (m.op === 'upsert' && m.data) {
        // Optimistic Concurrency Control (OCC): check current server row before overwriting
        const { data: existingServerRow } = await supabase
          .from(m.table)
          .select('id, data, updated_at')
          .eq('clinic_id', clinicId)
          .eq('id', m.id)
          .maybeSingle();

        if (
          existingServerRow?.data &&
          detectRevisionConflict({
            baseRev: m.baseRev,
            localData: m.data,
            serverData: existingServerRow.data as Record<string, unknown>,
            serverUpdatedAt: existingServerRow.updated_at,
            localUpdatedAt: m.updated_at,
          })
        ) {
          // Save both versions in Conflict Store for user comparison instead of silent overwrite
          await recordSyncConflict({
            conflictId: `${clinicId}:${m.table}:${m.id}`,
            clinic_id: clinicId,
            table: m.table,
            id: m.id,
            localData: m.data,
            serverData: existingServerRow.data as Record<string, unknown>,
            localRev: m.nextRev,
            serverRev: getRecordRev(existingServerRow.data as Record<string, unknown>),
            localUpdatedAt: m.updated_at,
            serverUpdatedAt: existingServerRow.updated_at || new Date().toISOString(),
            detectedAt: new Date().toISOString(),
          });
          succeeded = true; // Remove from outbox; now managed in conflict resolution queue
        } else {
          const { error } = await supabase.from(m.table).upsert(
            {
              clinic_id: clinicId,
              id: m.id,
              data: m.data,
            },
            { onConflict: 'clinic_id,id' }
          );
          if (!error) {
            succeeded = true;
            clearLocalWriteMark(m.table, m.id);
          }
        }
      } else if (m.op === 'delete') {
        const { error } = await supabase
          .from(m.table)
          .delete()
          .eq('clinic_id', clinicId)
          .eq('id', m.id);
        if (!error) {
          succeeded = true;
          clearLocalWriteMark(m.table, m.id);
        }
      }

      if (succeeded) {
        memoryOutboxFallback.delete(m.mutationId);
        if (db) {
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
  forceFull = false
): Promise<{ rows: CachedRow[]; error: Error | null; incremental: boolean }> {
  const cached = await getCachedTableRows(table);

  if (!supabase || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    const mergedOffline = await mergeFetchedRowsWithLocalState(table, [], cached, true);
    return { rows: mergedOffline, error: null, incremental: true };
  }

  await flushOfflineOutbox();

  const lastSyncedAt = await getLastSyncedAt(table);
  const useIncremental = !forceFull && Boolean(lastSyncedAt) && cached.length > 0;

  let query = supabase
    .from(table)
    .select('id, data, updated_at')
    .eq('clinic_id', clinicId);

  if (useIncremental && lastSyncedAt) {
    query = query.gt('updated_at', lastSyncedAt);
  }

  const { data, error } = await query;

  if (error) {
    return { rows: cached, error: new Error(error.message), incremental: useIncremental };
  }

  const incomingRows = (data || []) as CachedRow[];
  const merged = await mergeFetchedRowsWithLocalState(
    table,
    incomingRows,
    cached,
    useIncremental
  );

  if (useIncremental) {
    await putCachedTableRows(table, incomingRows);
  } else {
    await replaceCachedTableRows(table, merged);
  }

  if (table === 'settings') {
    const dbGenRow = incomingRows.find((r) => r.id === '_database_generation');
    if (dbGenRow?.data && typeof dbGenRow.data === 'object') {
      const remoteGen = String((dbGenRow.data as { generation?: string }).generation || '');
      if (remoteGen) {
        const localGen = typeof localStorage !== 'undefined' ? localStorage.getItem('soli_last_db_generation') : null;
        if (localGen && localGen !== remoteGen) {
          if (typeof localStorage !== 'undefined') localStorage.setItem('soli_last_db_generation', remoteGen);
          void clearCachedTables([
            'patients', 'appointments', 'visits', 'invoices', 'payments', 'transactions',
            'expenses', 'expense_categories', 'prescriptions', 'follow_ups', 'lab_orders',
            'radiology_orders', 'medications', 'lab_tests', 'radiology_types', 'diagnoses',
            'symptoms', 'chronic_diseases', 'services', 'backups', 'counters'
          ]).then(() => {
            notifyTableMutated(['*'], true);
          });
        } else if (!localGen && typeof localStorage !== 'undefined') {
          localStorage.setItem('soli_last_db_generation', remoteGen);
        }
      }
    }
  }

  let maxTs = lastSyncedAt || new Date(0).toISOString();
  for (const r of incomingRows) {
    if (r.updated_at && r.updated_at > maxTs) {
      maxTs = r.updated_at;
    }
  }
  if (incomingRows.length > 0 || !lastSyncedAt) {
    await setLastSyncedAt(table, maxTs === new Date(0).toISOString() ? new Date().toISOString() : maxTs);
  }

  return { rows: merged, error: null, incremental: useIncremental };
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
