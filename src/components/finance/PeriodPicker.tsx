import React from 'react';
import { todayKey } from '../../utils/dayKey';
import type { PeriodSel } from '../../services/financePaged';

const MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export function periodLabel(p: PeriodSel): string {
  if (p.year === 'all') return 'كل السنوات';
  if (p.month === 'all') return `كامل عام ${p.year}`;
  const mIndex = Number(p.month) - 1;
  const mName = MONTHS[mIndex] || p.month;
  return `${mName} ${p.year}`;
}

export const PeriodPicker: React.FC<{
  value: PeriodSel;
  onChange: (p: PeriodSel) => void;
}> = ({ value, onChange }) => {
  const y = Number(todayKey().slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => String(y - i));
  const cls =
    'px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#18233C] text-slate-800 dark:text-[#dde2f5] border border-slate-200 dark:border-white/10 outline-none cursor-pointer';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={cls}
        value={value.year}
        onChange={(e) =>
          onChange({
            year: e.target.value,
            month: e.target.value === 'all' ? 'all' : value.month,
          })
        }
      >
        <option value="all">كل السنوات</option>
        {years.map((yy) => (
          <option key={yy} value={yy}>
            {yy}
          </option>
        ))}
      </select>
      <select
        className={cls}
        value={value.month}
        disabled={value.year === 'all'}
        onChange={(e) => onChange({ ...value, month: e.target.value })}
      >
        <option value="all">كامل السنة</option>
        {MONTHS.map((m, i) => (
          <option key={m} value={String(i + 1).padStart(2, '0')}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
};
