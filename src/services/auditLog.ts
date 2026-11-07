import { supabase, clinicId } from './supabase';
import { safeStorage } from './storage';

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
  summary?: string;
  affectedTables?: string[];
  recordCounts?: Record<string, number>;
  status?: 'SUCCESS' | 'PARTIAL_FAILURE' | 'REJECTED' | 'ROLLBACK';
  details?: string | Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

const AUDIT_DOC_ID = '_audit_log';
const LOCAL_AUDIT_KEY = 'soli_clinic_audit_log';
const MAX_AUDIT_ENTRIES = 250;

export async function recordAuditLog(
  entry: Omit<AuditLogEntry, 'eventId' | 'timestamp' | 'clinicId'>
): Promise<AuditLogEntry> {
  const fullEntry: AuditLogEntry = {
    eventId: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    clinicId,
    actorUid: entry.actorUid || 'unknown',
    actorUsername: entry.actorUsername || 'unknown',
    permissionUsed: entry.permissionUsed || entry.action,
    status: entry.status || 'SUCCESS',
    ...entry,
  };

  // 1. Always append to local cache first for immediate resilience
  const existingLocal = safeStorage.getJSON<AuditLogEntry[]>(LOCAL_AUDIT_KEY, []);
  const updatedLocal = [fullEntry, ...(Array.isArray(existingLocal) ? existingLocal : [])].slice(
    0,
    MAX_AUDIT_ENTRIES
  );
  safeStorage.setJSON(LOCAL_AUDIT_KEY, updatedLocal);

  // 2. Append-only persistence in Supabase via security definer RPC (direct UPDATE/DELETE on _audit_log is blocked by RLS)
  if (supabase && clinicId) {
    try {
      await supabase.rpc('append_audit_log', {
        p_clinic_id: clinicId,
        p_entry: fullEntry,
      });
    } catch {
      // Non-blocking if user is offline; local audit log retains the entry
    }
  }

  return fullEntry;
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  if (supabase) {
    try {
      const { data } = await supabase
        .from('settings')
        .select('data')
        .eq('clinic_id', clinicId)
        .eq('id', AUDIT_DOC_ID)
        .maybeSingle();

      const entries = (data?.data as any)?.entries;
      if (Array.isArray(entries)) {
        return entries as AuditLogEntry[];
      }
    } catch {}
  }
  return safeStorage.getJSON<AuditLogEntry[]>(LOCAL_AUDIT_KEY, []);
}
