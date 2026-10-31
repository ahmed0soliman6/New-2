import React, { useState } from 'react';
import { recoverAdminPasswordWithCode } from '../../services/recovery';

interface AdminRecoveryDialogProps {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const AdminRecoveryDialog: React.FC<AdminRecoveryDialogProps> = ({ onClose, onSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setError('يرجى إدخال رمز الاسترداد.');
      return;
    }
    if (newPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 8 خانات.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('كلمة المرور وتأكيدها غير متطابقين.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await recoverAdminPasswordWithCode({
        username,
        recoveryCode,
        newPassword,
      });
      onSuccess(res.message);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'فشلت عملية الاسترداد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-purple-500/40 bg-white dark:bg-[#111A2E] p-6 shadow-2xl text-right space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2.5 text-purple-600 dark:text-purple-400">
            <span className="material-symbols-outlined text-2xl">key_vertical</span>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#dde2f5]">
              استرداد حساب مدير النظام
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

        <p className="text-xs text-slate-600 dark:text-[#859394] leading-relaxed">
          أدخل رمز الاسترداد المشفّر (SOLI-XXXX-XXXX...) لتعيين كلمة مرور جديدة لحساب المدير فوراً.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRecover} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] block mb-1">
              اسم المستخدم:
            </label>
            <input
              type="text"
              readOnly
              value={username}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#0c1322] p-2.5 text-xs text-slate-500 font-mono outline-none"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] block mb-1">
              رمز الاسترداد (Recovery Code):
            </label>
            <input
              required
              type="text"
              placeholder="SOLI-XXXX-XXXX-XXXX-XXXX-XXXX"
              value={recoveryCode}
              onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
              className="w-full rounded-xl border border-purple-300 dark:border-purple-600/40 bg-slate-50 dark:bg-[#0c1322] p-2.5 text-xs font-mono tracking-wider focus:ring-1 focus:ring-purple-500 outline-none uppercase font-bold"
              dir="ltr"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] block mb-1">
              كلمة المرور الجديدة (8 أحرف على الأقل):
            </label>
            <input
              required
              minLength={8}
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1322] p-2.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none"
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
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1322] p-2.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none"
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
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">
                {busy ? 'sync' : 'key'}
              </span>
              <span>{busy ? 'جارٍ التحقق والاسترداد...' : 'استرداد كلمة المرور الآن'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
