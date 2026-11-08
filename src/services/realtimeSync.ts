/**
 * Soli Medical: Supabase Realtime Unified Subscription Manager
 * Listens to postgres_changes events on the active clinic's tables (visits, appointments, settings, etc.)
 * and broadcasts immediate table mutation events so connected accounts (secretary & doctor) stay in sync
 * in under 200ms without manual page refreshes.
 */

import { supabase, clinicId as defaultClinicId } from './supabase';
import { notifyTableMutated, deleteCachedTableRow, clearCachedTables } from './offlineSync';
import { SettingsDocs } from './repositories/common';
import type { ClinicAlertPayload } from '../utils/alertManager';

export interface RealtimeSyncHandlers {
  onClinicStatusChange?: (status: 'available' | 'break', updatedBy?: string, updatedAt?: string) => void;
  onLatestAlert?: (alert: ClinicAlertPayload) => void;
  onTableChange?: (table: string, eventType: 'INSERT' | 'UPDATE' | 'DELETE', newRow?: any, oldRow?: any) => void;
  onDatabaseGenerationReset?: (epoch?: number | string) => void;
}

export function initClinicRealtime(
  targetClinicIdOrHandlers?: string | RealtimeSyncHandlers,
  handlersMaybe?: RealtimeSyncHandlers
): () => void {
  const handlers = typeof targetClinicIdOrHandlers === 'object' ? targetClinicIdOrHandlers : handlersMaybe;
  const targetClinicId = typeof targetClinicIdOrHandlers === 'string' ? targetClinicIdOrHandlers : defaultClinicId;

  if (!supabase || !targetClinicId) {
    return () => {};
  }

  const handleDatabaseReset = async (epoch?: number | string) => {
    const allTables = [
      'patients', 'appointments', 'visits', 'invoices', 'payments', 'transactions',
      'expenses', 'expense_categories', 'prescriptions', 'follow_ups', 'lab_orders',
      'radiology_orders', 'medications', 'lab_tests', 'radiology_types', 'diagnoses',
      'symptoms', 'chronic_diseases', 'services', 'backups', 'counters'
    ];
    try {
      await clearCachedTables(allTables);
      if (typeof localStorage !== 'undefined' && epoch) {
        localStorage.setItem('soli_last_db_generation', String(epoch));
      }
    } catch {}
    notifyTableMutated(['*'], true);
    handlers?.onDatabaseGenerationReset?.(epoch);
  };

  const channelName = `soli_realtime:${targetClinicId}`;
  const channel = supabase.channel(channelName);

  // 1. Listen to Postgres changes for all relevant clinic tables
  const monitoredTables = [
    'visits',
    'appointments',
    'patients',
    'invoices',
    'payments',
    'prescriptions',
    'lab_orders',
    'radiology_orders',
    'follow_ups',
    'settings',
  ];

  for (const table of monitoredTables) {
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table,
        filter: `clinic_id=eq.${targetClinicId}`,
      },
      (payload) => {
        const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
        const newRow = payload.new as Record<string, any> | undefined;
        const oldRow = payload.old as Record<string, any> | undefined;

        if (eventType === 'DELETE') {
          const deletedId = oldRow?.id;
          if (deletedId) {
            void deleteCachedTableRow(table, deletedId);
            notifyTableMutated([table], false);
          } else {
            notifyTableMutated([table], true);
          }
          handlers?.onTableChange?.(table, eventType, undefined, oldRow);
          return;
        }

        // Special handling for settings documents (clinicStatus, latestAlert, databaseGeneration)
        if (table === 'settings' && newRow) {
          const docId = newRow.id;
          const data = (newRow.data || {}) as Record<string, any>;

          if (docId === SettingsDocs.CLINIC_STATUS && data.status) {
            handlers?.onClinicStatusChange?.(
              data.status as 'available' | 'break',
              data.updatedBy,
              data.updatedAt || newRow.updated_at
            );
          } else if (docId === SettingsDocs.LATEST_ALERT && data.id) {
            handlers?.onLatestAlert?.(data as ClinicAlertPayload);
          } else if (docId === '_database_generation' && (data.dbEpoch || data.generation)) {
            void handleDatabaseReset(data.dbEpoch || data.generation);
          }
        }

        handlers?.onTableChange?.(table, eventType, newRow, oldRow);
        // Dispatch local event to trigger incremental or full sync in repositories
        notifyTableMutated([table], false);
      }
    );
  }

  // 2. Also listen for custom BroadcastChannel messages within the Supabase Realtime channel
  channel
    .on('broadcast', { event: 'CLINIC_ALERT' }, (payload) => {
      if (payload?.payload) {
        handlers?.onLatestAlert?.(payload.payload as ClinicAlertPayload);
      }
    })
    .on('broadcast', { event: 'STATUS_CHANGE' }, (payload) => {
      if (payload?.payload?.status) {
        handlers?.onClinicStatusChange?.(
          payload.payload.status,
          payload.payload.updatedBy,
          payload.payload.updatedAt
        );
      }
    })
    .on('broadcast', { event: 'CLEAR_ALL_DATA' }, (payload) => {
      void handleDatabaseReset(payload?.payload?.dbEpoch);
    });

  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      // Channel successfully joined
    } else if (status === 'CHANNEL_ERROR') {
      console.warn('[Realtime notice] Channel connection error; will retry automatically.');
    }
  });

  return () => {
    try {
      void supabase.removeChannel(channel);
    } catch {}
  };
}

/**
 * Broadcast an instant alert to all active connected clinic users via Realtime
 */
export async function broadcastRealtimeAlert(
  alert: ClinicAlertPayload | Record<string, unknown>
): Promise<void> {
  if (!supabase || !defaultClinicId) return;
  try {
    const channel = supabase.channel(`soli_realtime:${defaultClinicId}`);
    await channel.send({
      type: 'broadcast',
      event: 'CLINIC_ALERT',
      payload: alert as Record<string, unknown>,
    });
  } catch {}
}

/**
 * Broadcast an instant doctor status update to all connected clinic users via Realtime
 */
export async function broadcastRealtimeDoctorStatus(
  status: 'available' | 'break',
  updatedBy: string
): Promise<void> {
  if (!supabase || !defaultClinicId) return;
  try {
    const channel = supabase.channel(`soli_realtime:${defaultClinicId}`);
    await channel.send({
      type: 'broadcast',
      event: 'STATUS_CHANGE',
      payload: {
        status,
        updatedBy,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch {}
}

/**
 * Broadcast a database clear event to immediately purge in-memory and offline caches on other clients
 */
export async function broadcastRealtimeDatabaseClear(dbEpoch: number): Promise<void> {
  if (!supabase || !defaultClinicId) return;
  try {
    const channel = supabase.channel(`soli_realtime:${defaultClinicId}`);
    await channel.send({
      type: 'broadcast',
      event: 'CLEAR_ALL_DATA',
      payload: { dbEpoch },
    });
  } catch {}
}
