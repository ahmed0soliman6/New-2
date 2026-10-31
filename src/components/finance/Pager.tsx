import React from 'react';

export const Pager: React.FC<{
  pageIndex: number;
  hasNext: boolean;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}> = ({ pageIndex, hasNext, loading, onPrev, onNext }) => {
  const btn =
    'px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 bg-white dark:bg-[#18233C] text-slate-800 dark:text-[#dde2f5] hover:bg-slate-50 dark:hover:bg-[#223254] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-2xs';

  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <button
        type="button"
        className={btn}
        disabled={pageIndex === 0 || loading}
        onClick={onPrev}
      >
        السابق
      </button>
      <span className="text-xs font-bold text-slate-600 dark:text-[#bbc9ca] font-mono">
        صفحة {pageIndex + 1}
        {loading ? ' … جارٍ التحميل' : ''}
      </span>
      <button
        type="button"
        className={btn}
        disabled={!hasNext || loading}
        onClick={onNext}
      >
        التالي
      </button>
    </div>
  );
};
