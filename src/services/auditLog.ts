import { supabase, clinicId } from './supabase';
import { safeStorage } from './storage';

export const ALLOWED_AUDIT_ACTIONS = [
  'patient.create',
  'patient.update',
  'patient.delete',
  'visit.create',
  'visit.complete',
  'visit.delete',
  'appointment.create',
  'appointment.update',
  'appointment.delete',
  'appointment.checkin',
  'invoice.create',
  'invoice.update',
  'invoice.delete',
  'payment.create',
  'payment.update',
  'payment.delete',
  'expense.create',
  'expense.update',
  'expense.delete',
  'user.create',
  'user.update',
  'user.delete',
  'user.permissions.update',
  'user.password.reset',
  'UPDATE_USER_PERMISSIONS',
  'settings.update',
  'backup.export',
  'backup.restore',
  'backup.restore.rollback',
  'system.clear_all_data',
  'system.clear_all_data.failed',
  'data.purge',
  'demo.generate_data',
] as const;

export const CRITICAL_AUDIT_ACTIONS = new Set<string>([
  'system.clear_all_data',
  'backup.restore',
  'data.purge',
]);

export interface AuditLogEntry {
  eventId: string;
  timestamp: string;
  clinicId: string;
  actorUid?: string;
  actorUsername?: string;
  actorRole?: string;
  action: string;
  permissionUsed?: string;
  targetType?: string;
  targetId?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  summary?: string;
  affectedTables?: string[];
  recordCounts?: Record<string, number>;
  status?: 'SUCCESS' | 'PARTIAL_FAILURE' | 'REJECTED' | 'ROLLBACK';
  details?: string | Record<string, unknown>;
  metadata?: Record<string, unknown>;
  cloudSyncWarning?: string;
}

export interface QueuedAuditRpcItem {
  id: string;
  clinicId: string;
  queuedAt: string;
  attempts: number;
  lastError?: string;
  payload: {
    action: string;
    entity_type: string | null;
    entity_id: string | null;
    details: Record<string, unknown>;
  };
}

const LEGACY_AUDIT_DOC_ID = '_audit_log';
const LOCAL_AUDIT_KEY = 'soli_clinic_audit_log';
export const AUDIT_RETRY_QUEUE_KEY = 'soli_clinic_audit_retry_queue';
const MAX_LOCAL_AUDIT_ENTRIES = 500;
const MAX_RETRY_QUEUE_ENTRIES = 250;
const MAX_DETAILS_BYTES = 8192;

function buildSanitizedDetails(entry: Omit<AuditLogEntry, 'eventId' | 'timestamp' | 'clinicId'>): Record<string, unknown> {
  const detailsObj: Record<string, unknown> = {};

  if (entry.details && typeof entry.details === 'object' && !Array.isArray(entry.details)) {
    for (const [k, v] of Object.entries(entry.details)) {
      if (!['actorName', 'actorUid', 'actor_uid', 'actorUsername', 'actorRole', 'clinicId', 'clinic_id'].includes(k)) {
        detailsObj[k] = v;
      }
    }
  } else if (typeof entry.details === 'string' && entry.details.trim()) {
    detailsObj.message = entry.details.trim();
  }

  if (entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)) {
    const cleanMeta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entry.metadata)) {
      if (!['actorName', 'actorUid', 'actor_uid', 'actorUsername', 'actorRole', 'clinicId', 'clinic_id'].includes(k)) {
        cleanMeta[k] = v;
      }
    }
    detailsObj.metadata = cleanMeta;
  }

  if (entry.summary) detailsObj.summary = entry.summary;
  if (entry.status) detailsObj.status = entry.status;
  if (entry.permissionUsed) detailsObj.permissionUsed = entry.permissionUsed;
  if (Array.isArray(entry.affectedTables)) detailsObj.affectedTables = entry.affectedTables;
  if (entry.recordCounts && typeof entry.recordCounts === 'object') detailsObj.recordCounts = entry.recordCounts;

  return detailsObj;
}

export function getPendingAuditRetryQueue(): QueuedAuditRpcItem[] {
  const queue = safeStorage.getJSON<QueuedAuditRpcItem[]>(AUDIT_RETRY_QUEUE_KEY, []);
  return Array.isArray(queue) ? queue : [];
}

function enqueueFailedAuditRpc(item: QueuedAuditRpcItem): void {
  const existing = getPendingAuditRetryQueue().filter((q) => q.id !== item.id);
  const updated = [...existing, item].slice(-MAX_RETRY_QUEUE_ENTRIES);
  safeStorage.setJSON(AUDIT_RETRY_QUEUE_KEY, updated);
}

function notifyCriticalAuditFailure(action: string, errorMessage: string): string {
  const warningMsg = `تنبيه أمني: فشل تسجيل حدث المراجعة السحابي للعملية الحرجة (${action}). تم الاحتفاظ بالحدث في الطابور المحلي لإعادة المحاولة تلقائياً. السبب: ${errorMessage}`;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('soli_audit_critical_warning', {
        detail: { action, errorMessage, warning: warningMsg, timestamp: new Date().toISOString() },
      })
    );
  }
  return warningMsg;
}

let isFlushingAuditQueue = false;

export async function flushPendingAuditLogs(): Promise<{ succeeded: number; remaining: number }> {
  const queue = getPendingAuditRetryQueue();
  if (!supabase || !clinicId || queue.length === 0 || isFlushingAuditQueue) {
    return { succeeded: 0, remaining: queue.length };
  }

  isFlushingAuditQueue = true;
  const remainingQueue: QueuedAuditRpcItem[] = [];
  let succeeded = 0;

  try {
    for (const item of queue) {
      try {
        const { error } = await supabase.rpc('append_audit_log', {
          p_clinic_id: item.clinicId || clinicId,
          p_entry: item.payload,
        });
        if (error) {
          remainingQueue.push({
            ...item,
            attempts: (item.attempts || 1) + 1,
            lastError: error.message || String(error),
          });
        } else {
          succeeded += 1;
        }
      } catch (err) {
        remainingQueue.push({
          ...item,
          attempts: (item.attempts || 1) + 1,
          lastError: err instanceof Error ? err.message : String(err),
        });
      }
    }
    safeStorage.setJSON(AUDIT_RETRY_QUEUE_KEY, remainingQueue);
  } finally {
    isFlushingAuditQueue = false;
  }

  return { succeeded, remaining: remainingQueue.length };
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('online', () => {
    void flushPendingAuditLogs();
  });
}

export async function recordAuditLog(
  entry: Omit<AuditLogEntry, 'eventId' | 'timestamp' | 'clinicId'>
): Promise<AuditLogEntry> {
  const sanitizedDetails = buildSanitizedDetails(entry);
  const entityType = entry.entity_type ?? entry.targetType ?? null;
  const entityId = entry.entity_id ?? entry.targetId ?? null;

  const fullEntry: AuditLogEntry = {
    eventId: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    clinicId,
    actorUid: entry.actorUid || 'unknown',
    action: entry.action,
    permissionUsed: entry.permissionUsed || entry.action,
    targetType: entityType || undefined,
    targetId: entityId || undefined,
    entity_type: entityType,
    entity_id: entityId,
    status: entry.status || 'SUCCESS',
    summary: entry.summary,
    affectedTables: entry.affectedTables,
    recordCounts: entry.recordCounts,
    details: sanitizedDetails,
    metadata: entry.metadata,
  };

  // 1. Append to local browser cache for offline resilience
  const existingLocal = safeStorage.getJSON<AuditLogEntry[]>(LOCAL_AUDIT_KEY, []);
  const updatedLocal = [fullEntry, ...(Array.isArray(existingLocal) ? existingLocal : [])].slice(
    0,
    MAX_LOCAL_AUDIT_ENTRIES
  );
  safeStorage.setJSON(LOCAL_AUDIT_KEY, updatedLocal);

  const rpcPayload = {
    action: entry.action,
    entity_type: entityType,
    entity_id: entityId,
    details: sanitizedDetails,
  };

  // 2. Append row to public.audit_events via SECURITY DEFINER RPC (append_audit_log)
  if (supabase && clinicId) {
    try {
      const serialized = JSON.stringify(rpcPayload);
      if (new TextEncoder().encode(serialized).length > MAX_DETAILS_BYTES) {
        throw new Error('حجم تفاصيل سجل المراجعة يتجاوز الحد المسموح (8KB)');
      }

      const { data, error } = await supabase.rpc('append_audit_log', {
        p_clinic_id: clinicId,
        p_entry: rpcPayload,
      });

      if (error) {
        const errMsg = error.message || 'خطأ في استدعاء append_audit_log';
        enqueueFailedAuditRpc({
          id: fullEntry.eventId,
          clinicId,
          queuedAt: fullEntry.timestamp,
          attempts: 1,
          lastError: errMsg,
          payload: rpcPayload,
        });
        if (CRITICAL_AUDIT_ACTIONS.has(entry.action)) {
          fullEntry.cloudSyncWarning = notifyCriticalAuditFailure(entry.action, errMsg);
        }
      } else {
        if (data && typeof data === 'object' && (data as any).id) {
          fullEntry.eventId = String((data as any).id);
          if ((data as any).actor_uid) {
            fullEntry.actorUid = String((data as any).actor_uid);
          }
          if ((data as any).created_at) {
            fullEntry.timestamp = String((data as any).created_at);
          }
        }
        // Opportunistically flush any previously queued audit logs in the background
        if (getPendingAuditRetryQueue().length > 0) {
          void flushPendingAuditLogs();
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'تعذر الاتصال بقاعدة البيانات السحابية';
      enqueueFailedAuditRpc({
        id: fullEntry.eventId,
        clinicId,
        queuedAt: fullEntry.timestamp,
        attempts: 1,
        lastError: errMsg,
        payload: rpcPayload,
      });
      if (CRITICAL_AUDIT_ACTIONS.has(entry.action)) {
        fullEntry.cloudSyncWarning = notifyCriticalAuditFailure(entry.action, errMsg);
      }
    }
  } else if (clinicId) {
    enqueueFailedAuditRpc({
      id: fullEntry.eventId,
      clinicId,
      queuedAt: fullEntry.timestamp,
      attempts: 0,
      lastError: 'عميل Supabase غير مهيأ حالياً',
      payload: rpcPayload,
    });
    if (CRITICAL_AUDIT_ACTIONS.has(entry.action)) {
      fullEntry.cloudSyncWarning = notifyCriticalAuditFailure(entry.action, 'عميل السحابة غير متصل');
    }
  }

  return fullEntry;
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  if (supabase && clinicId) {
    if (getPendingAuditRetryQueue().length > 0) {
      await flushPendingAuditLogs();
    }
    const merged: AuditLogEntry[] = [];
    const seenIds = new Set<string>();

    // 1. Primary source: immutable public.audit_events table
    try {
      const { data: rows } = await supabase
        .from('audit_events')
        .select('id, clinic_id, actor_uid, action, entity_type, entity_id, details, created_at')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (Array.isArray(rows)) {
        for (const r of rows) {
          const detailsObj =
            r.details && typeof r.details === 'object' && !Array.isArray(r.details)
              ? (r.details as Record<string, any>)
              : {};
          const entryId = String(r.id);
          seenIds.add(entryId);
          merged.push({
            eventId: entryId,
            timestamp: String(r.created_at),
            clinicId: String(r.clinic_id),
            actorUid: String(r.actor_uid),
            action: String(r.action),
            targetType: r.entity_type ? String(r.entity_type) : undefined,
            targetId: r.entity_id ? String(r.entity_id) : undefined,
            entity_type: r.entity_type ? String(r.entity_type) : null,
            entity_id: r.entity_id ? String(r.entity_id) : null,
            summary: typeof detailsObj.summary === 'string' ? detailsObj.summary : undefined,
            status: detailsObj.status || 'SUCCESS',
            permissionUsed: typeof detailsObj.permissionUsed === 'string' ? detailsObj.permissionUsed : String(r.action),
            affectedTables: Array.isArray(detailsObj.affectedTables) ? detailsObj.affectedTables : undefined,
            recordCounts: detailsObj.recordCounts,
            details: detailsObj,
            metadata: detailsObj.metadata,
          });
        }
      }
    } catch {}

    // 2. Read-only backward compatibility: legacy settings._audit_log if present
    try {
      const { data: legacyDoc } = await supabase
        .from('settings')
        .select('data')
        .eq('clinic_id', clinicId)
        .eq('id', LEGACY_AUDIT_DOC_ID)
        .maybeSingle();

      const legacyEntries = (legacyDoc?.data as any)?.entries;
      if (Array.isArray(legacyEntries)) {
        for (const leg of legacyEntries as AuditLogEntry[]) {
          const legId = leg?.eventId || `${leg?.action}-${leg?.timestamp}`;
          if (leg && !seenIds.has(legId)) {
            seenIds.add(legId);
            merged.push(leg);
          }
        }
      }
    } catch {}

    if (merged.length > 0) {
      return merged.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
    }
  }

  return safeStorage.getJSON<AuditLogEntry[]>(LOCAL_AUDIT_KEY, []);
}
