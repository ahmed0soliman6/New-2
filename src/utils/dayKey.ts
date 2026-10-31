const CAIRO_TZ = 'Africa/Cairo';
const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CAIRO_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export type DateLike = Date | string | number | { toDate: () => Date } | null | undefined;

export function toDate(input: DateLike): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === 'object' && 'toDate' in input && typeof input.toDate === 'function') {
    return input.toDate();
  }
  const d = new Date(input as string | number);
  return isNaN(d.getTime()) ? null : d;
}

/** YYYY-MM-DD بتوقيت القاهرة */
export function toDayKey(input?: DateLike): string {
  return fmt.format(toDate(input) ?? new Date());
}

export const todayKey = () => toDayKey(new Date());

export function addDaysToKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
