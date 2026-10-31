import React, { useState } from 'react';
import { changeUserPassword } from '../../services/auth';

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose, onSuccess }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة وتأكيدها غير متطابقين.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await changeUserPassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      onSuccess('تم تغيير كلمة المرور بنجاح.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تغيير كلمة المرور.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111A2E] p-6 shadow-2xl text-right space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2 text-teal-600 dark:text-[#45dee7]">
            <span className="material-symbols-outlined text-2xl">key</span>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#dde2f5]">
              تغيير كلمة مرور الحساب
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] block mb-1">
              كلمة المرور الحالية (اختياري للتحقق):
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1322] p-2.5 text-xs focus:ring-1 focus:ring-[#00c2cb] outline-none"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] block mb-1">
              كلمة المرور الجديدة (8 أحرف فأكثر):
            </label>
            <input
              required
              minLength={8}
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1322] p-2.5 text-xs focus:ring-1 focus:ring-[#00c2cb] outline-none"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] block mb-1">
              تأكيد كلمة المرور الجديدة:
            </label>
            <input
              required
              minLength={8}
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1322] p-2.5 text-xs focus:ring-1 focus:ring-[#00c2cb] outline-none"
              dir="ltr"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">
                {busy ? 'sync' : 'lock_reset'}
              </span>
              <span>{busy ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
