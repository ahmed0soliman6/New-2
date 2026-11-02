import { supabase, clinicId } from './supabase';
import { mapDocs, type SupabaseDocRow } from './repositories/common';
import { meterRead } from './readMeter';
import { toDayKey } from '../utils/dayKey';
import type { Visit } from '../types/database';

export async function fetchVisitCounts(fromKey?: string, toKey?: string) {
  if (!supabase) throw new Error('عميل Supabase غير مهيأ');
  const { data, error } = await supabase
    .from('visits')
    .select('id, data, updated_at')
    .eq('clinic_id', clinicId);

  if (error) throw new Error(error.message);

  const allVisits = mapDocs<Visit>('visits', (data || []) as SupabaseDocRow[]).filter((v) => {
    const dk = v.dayKey || (v.createdAt ? toDayKey(v.createdAt) || v.createdAt.slice(0, 10) : '');
    if (fromKey && (!dk || dk < fromKey)) return false;
    if (toKey && (!dk || dk > toKey)) return false;
    return true;
  });

  const completed = allVisits.filter((v) => v.status === 'COMPLETED').length;
  meterRead('لوحة التحكم', 2);
  return { total: allVisits.length, completed };
}
