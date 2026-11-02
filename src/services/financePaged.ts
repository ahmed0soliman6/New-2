import { supabase, clinicId } from './supabase';
import { mapDocs, resolveTableName, type SupabaseDocRow } from './repositories/common';
import { meterRead } from './readMeter';
import { todayKey, toDayKey } from '../utils/dayKey';
import type { Invoice, Payment } from '../types/database';

export const FINANCE_PAGE_SIZE = 25;

/** year: 'all' | '2026' ، month: 'all' | '01'..'12' */
export type PeriodSel = { year: string; month: string };
export type KeyRange = { from?: string; to?: string };
export type PageCursor = number;

export function currentPeriod(): PeriodSel {
  const t = todayKey();
  return { year: t.slice(0, 4), month: t.slice(5, 7) };
}

export function periodToRange(sel: PeriodSel): KeyRange {
  if (sel.year === 'all') return {};
  if (sel.month === 'all') return { from: `${sel.year}-01-01`, to: `${sel.year}-12-31` };
  return { from: `${sel.year}-${sel.month}-01`, to: `${sel.year}-${sel.month}-31` };
}

function resolveItemDateKey(name: 'payments' | 'expenses', item: Record<string, unknown>): string {
  if (name === 'payments') {
    const dayKey = typeof item.dayKey === 'string' && item.dayKey ? item.dayKey : '';
    if (dayKey) return dayKey;
    const paidAt = typeof item.paidAt === 'string' && item.paidAt ? item.paidAt : '';
    if (paidAt) return toDayKey(paidAt) || paidAt.slice(0, 10);
    return '';
  }
  const dateStr = typeof item.date === 'string' && item.date ? item.date : '';
  if (dateStr) return dateStr.slice(0, 10);
  const createdAt = typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : '';
  return createdAt ? toDayKey(createdAt) || createdAt.slice(0, 10) : '';
}

function matchesKeyRange(dateKey: string, r: KeyRange): boolean {
  if (!r.from && !r.to) return true;
  if (!dateKey) return false;
  if (r.from && dateKey < r.from) return false;
  if (r.to && dateKey > r.to) return false;
  return true;
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('عميل Supabase غير مهيأ');
  }
  return supabase;
}

export interface PageResult<T> {
  items: T[];
  cursor: PageCursor | null;
  hasNext: boolean;
}

/** مجموع وعدد السجلات للفترة المحددة من Supabase */
export async function fetchTotal(
  name: 'payments' | 'expenses',
  r: KeyRange
): Promise<{ total: number; count: number }> {
  const client = requireSupabase();
  const tableName = resolveTableName(name);
  const { data, error } = await client
    .from(tableName)
    .select('id, data, updated_at')
    .eq('clinic_id', clinicId);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data || []) as SupabaseDocRow[];
  const items = mapDocs<Record<string, unknown>>(tableName, rows);
  const filtered = items.filter((item) => matchesKeyRange(resolveItemDateKey(name, item), r));

  meterRead('مالية', Math.max(1, filtered.length));

  const total = filtered.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  return { total, count: filtered.length };
}

/** صفحة واحدة من الدفعات + فواتير هذه الصفحة فقط */
export async function fetchPaymentsPage(
  r: KeyRange,
  after: PageCursor | unknown | null
): Promise<PageResult<Payment> & { invoices: Invoice[] }> {
  const client = requireSupabase();
  const offset = typeof after === 'number' && after > 0 ? after : 0;

  const { data, error } = await client
    .from('payments')
    .select('id, data, updated_at')
    .eq('clinic_id', clinicId);

  if (error) {
    throw new Error(error.message);
  }

  const allPayments = mapDocs<Payment>('payments', (data || []) as SupabaseDocRow[]);
  const filtered = allPayments
    .filter((p) => matchesKeyRange(resolveItemDateKey('payments', p as unknown as Record<string, unknown>), r))
    .sort((a, b) => {
      const aTime = a.paidAt || a.dayKey || '';
      const bTime = b.paidAt || b.dayKey || '';
      return bTime.localeCompare(aTime);
    });

  const pageSlice = filtered.slice(offset, offset + FINANCE_PAGE_SIZE);
  const hasNext = filtered.length > offset + FINANCE_PAGE_SIZE;
  meterRead('مالية', Math.max(1, pageSlice.length));

  const ids = [...new Set(pageSlice.map((p) => p.invoiceId).filter(Boolean))];
  let invoices: Invoice[] = [];
  if (ids.length > 0) {
    const { data: invData, error: invError } = await client
      .from('invoices')
      .select('id, data, updated_at')
      .eq('clinic_id', clinicId)
      .in('id', ids);

    if (invError) {
      throw new Error(invError.message);
    }
    invoices = mapDocs<Invoice>('invoices', (invData || []) as SupabaseDocRow[]);
    meterRead('مالية', Math.max(1, invoices.length));
  }

  return {
    items: pageSlice,
    invoices,
    cursor: hasNext ? offset + FINANCE_PAGE_SIZE : null,
    hasNext,
  };
}

/** الفواتير غير المسددة (عادة قليلة) */
export async function fetchUnpaidInvoices(): Promise<Invoice[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('invoices')
    .select('id, data, updated_at')
    .eq('clinic_id', clinicId);

  if (error) {
    throw new Error(error.message);
  }

  const allInvoices = mapDocs<Invoice>('invoices', (data || []) as SupabaseDocRow[]);
  const unpaid = allInvoices
    .filter((inv) => inv.status === 'UNPAID' || inv.status === 'PARTIALLY_PAID')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 100);

  meterRead('مالية', Math.max(1, unpaid.length));
  return unpaid;
}

/** صفحة واحدة من المصروفات */
export async function fetchExpensesPage<T = Record<string, unknown>>(
  r: KeyRange,
  after: PageCursor | unknown | null
): Promise<PageResult<T>> {
  const client = requireSupabase();
  const offset = typeof after === 'number' && after > 0 ? after : 0;

  const { data, error } = await client
    .from('expenses')
    .select('id, data, updated_at')
    .eq('clinic_id', clinicId);

  if (error) {
    throw new Error(error.message);
  }

  const allExpenses = mapDocs<Record<string, unknown>>('expenses', (data || []) as SupabaseDocRow[]);
  const filtered = allExpenses
    .filter((exp) => matchesKeyRange(resolveItemDateKey('expenses', exp), r))
    .sort((a, b) => {
      const aDate = String(a.date || a.createdAt || '');
      const bDate = String(b.date || b.createdAt || '');
      return bDate.localeCompare(aDate);
    });

  const pageSlice = filtered.slice(offset, offset + FINANCE_PAGE_SIZE) as T[];
  const hasNext = filtered.length > offset + FINANCE_PAGE_SIZE;
  meterRead('مالية', Math.max(1, pageSlice.length));

  return {
    items: pageSlice,
    cursor: hasNext ? offset + FINANCE_PAGE_SIZE : null,
    hasNext,
  };
}
