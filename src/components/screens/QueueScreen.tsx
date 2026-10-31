import React, { useState } from 'react';
import { QueueItem, ScreenType } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';

interface QueueScreenProps {
  queue: QueueItem[];
  onCallPatient: (ticket: string, name: string) => void;
  onNavigate: (screen: ScreenType) => void;
  onRemoveFromQueue?: (ticket: string) => void;
  onOpenNewVisit?: () => void;
}

export const QueueScreen: React.FC<QueueScreenProps> = ({
  queue,
  onCallPatient,
  onNavigate,
  onRemoveFromQueue,
  onOpenNewVisit,
}) => {
  const { t } = useLanguage();
  const [patientToRemove, setPatientToRemove] = useState<QueueItem | null>(null);
  const [notification, setNotification] = useState<{
    id: string;
    patientName: string;
    visible: boolean;
  } | null>(null);

  const handleOpenExam = (item: QueueItem) => {
    onCallPatient(item.ticketNumber, item.patientName);
    onNavigate('clinical-exam');
  };

  const confirmRemove = () => {
    if (patientToRemove && onRemoveFromQueue) {
      onRemoveFromQueue(patientToRemove.id);
      setPatientToRemove(null);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-full overflow-x-hidden pb-28 space-y-5 text-slate-800 dark:text-[#dde2f5]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {t('queue.title')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-[#859394] mt-0.5">
            {t('queue.subtitle')}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onOpenNewVisit) onOpenNewVisit();
            else onNavigate('new-visit');
          }}
          className="flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-[#00c2cb]/20 transition-all cursor-pointer active:scale-95 shrink-0"
        >
          <span className="material-symbols-outlined text-base sm:text-lg">person_add</span>
          <span>{t('queue.addVisit')}</span>
        </button>
      </div>

      {/* Total Waiting Counter Card */}
      <div className="w-full bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs flex items-center justify-between">
        <span className="text-xs sm:text-sm font-bold text-slate-500 dark:text-[#859394]">
          {t('queue.totalWaiting')}
        </span>
        <span className="text-3xl sm:text-4xl font-black text-[#008f97] dark:text-[#00c2cb] font-mono">
          {queue.length}
        </span>
      </div>

      {/* Queue Patient Cards List */}
      <div className="w-full space-y-3">
        {queue.length === 0 ? (
          <div className="w-full bg-white dark:bg-[#111A2E] p-8 rounded-2xl border border-dashed border-slate-300 dark:border-white/10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-[#00c2cb]/10 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-2xl">done_all</span>
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{t('queue.emptyTitle')}</h3>
            <p className="text-xs text-slate-500 dark:text-[#859394]">
              {t('queue.emptyDesc')}
            </p>
          </div>
        ) : (
          queue.map((item) => (
            <div
              key={item.id}
              className="w-full bg-white dark:bg-[#111A2E] p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-[#00c2cb]/50"
            >
              {/* Patient Info Block */}
              <div className="flex items-start gap-3.5 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-teal-50 dark:bg-[#00c2cb]/15 text-[#008f97] dark:text-[#00c2cb] flex items-center justify-center font-bold text-lg shrink-0">
                  {item.patientName ? item.patientName.charAt(0) : 'P'}
                </div>

                <div className="min-w-0 space-y-1 flex-1">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white break-words">
                    {item.patientName}
                  </h2>

                  <p className="text-xs text-slate-500 dark:text-[#859394] font-medium">
                    {item.visitType || t('intake.newExam')}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 text-[11px] font-bold">
                      {t('queue.waiting')}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-[#859394] font-mono">
                      {item.phone || '—'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-500 dark:text-[#859394] font-mono flex items-center gap-2 pt-0.5">
                    <span className="font-bold">{t('queue.ticketShort')}{item.ticketNumber}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-[#008f97] dark:text-[#00c2cb] font-bold">
                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                      <span>{t('queue.arrivalLabel')} {item.arrivalTime || '—'}</span>
                    </span>
                  </p>
                </div>
              </div>

              {/* Action Buttons Block */}
              <div className="flex flex-wrap items-center gap-2.5 self-stretch md:self-center justify-start md:justify-end shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setPatientToRemove(item)}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-[#18233C] dark:hover:bg-rose-950/40 dark:text-[#bbc9ca] dark:hover:text-rose-400 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                >
                  <span className="text-sm">✕</span>
                  <span>{t('queue.removeFromQueue')}</span>
                </button>

                <div className="relative inline-block">
                  <select
                    defaultValue="waiting"
                    className="appearance-none bg-amber-50 dark:bg-amber-950/40 text-[#B45309] dark:text-amber-300 border border-amber-200 dark:border-amber-800/40 text-xs font-bold py-2.5 pr-3 pl-8 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="waiting">{t('queue.waiting')}</option>
                    <option value="in-exam">{t('queue.inConsultation')}</option>
                    <option value="completed">{t('queue.completed')}</option>
                  </select>
                  <span className="material-symbols-outlined text-sm absolute left-2 top-3 pointer-events-none text-amber-700 dark:text-amber-400">
                    expand_more
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenExam(item)}
                  className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-[#00c2cb]/20 transition-all cursor-pointer active:scale-95"
                >
                  <span className="material-symbols-outlined text-lg">stethoscope</span>
                  <span>{t('queue.startExam')}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Floating Notification Toast */}
      {notification && notification.visible && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:right-8 sm:translate-x-0 z-50 bg-white dark:bg-[#18233C] border border-[#00c2cb]/40 p-4 rounded-2xl shadow-2xl flex items-center gap-3.5 max-w-sm sm:max-w-md w-[92vw] sm:w-auto animate-in slide-in-from-bottom duration-300">
          <div className="w-10 h-10 rounded-xl bg-[#00c2cb] text-slate-950 flex items-center justify-center shrink-0 shadow-sm font-bold">
            <span className="material-symbols-outlined text-xl">notifications_active</span>
          </div>

          <div className="flex-1 text-right min-w-0">
            <span className="text-[11px] font-bold text-[#008f97] dark:text-[#45dee7] block">
              {t('queue.newPatientArrived')}
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {notification.patientName}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-[#859394]">
              {t('queue.addedToQueue')}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setNotification(null)}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0 font-bold"
            aria-label="إغلاق التنبيه"
          >
            ✕
          </button>
        </div>
      )}

      {/* Confirmation Modal for Removing Patient from Queue */}
      {patientToRemove && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111A2E] border border-rose-500/30 rounded-3xl p-5 max-w-sm w-full text-center space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">person_remove</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {t('queue.confirmRemove')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#859394] leading-relaxed">
                {t('queue.confirmRemoveDesc')} <strong className="text-slate-800 dark:text-white">({patientToRemove.patientName})</strong> #{patientToRemove.ticketNumber}
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPatientToRemove(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#18233C] text-slate-700 dark:text-[#dde2f5] text-xs font-bold transition-all cursor-pointer"
              >
                {t('action.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmRemove}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                {t('action.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
