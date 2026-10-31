import React, { useState } from 'react';
import { changeUserPassword } from '../../services/auth';
import { usePermissions } from '../../context/AuthContext';
import { ROLE_LABELS } from '../../permissions';

interface ChangePasswordCardProps {
  onNotify?: (msg: string) => void;
  isOpen?: boolean;
  onToggle?: () => void;
  cardNumber?: number | string;
}

export const ChangePasswordCard: React.FC<ChangePasswordCardProps> = ({
  onNotify,
  isOpen = false,
  onToggle,
  cardNumber,
}) => {
  const { userProfile, role } = usePermissions();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب ألا تقل عن 8 خانات.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('كلمة المرور الجديدة وتأكيدها غير متطابقين.');
      return;
    }

    setBusy(true);
    try {
      await changeUserPassword({
        currentPassword: currentPassword || undefined,
        newPassword,
      });
      const msg = 'تم تغيير كلمة المرور بنجاح.';
      setSuccess(msg);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onNotify) {
        onNotify(msg);
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'تعذر تغيير كلمة المرور.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#111A2E] rounded-2xl border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden transition-all">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-5 flex items-center justify-between text-right cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-[#f5a623] flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-xl">vpn_key</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
              <span>{cardNumber ? `${cardNumber}. ` : ''}تغيير كلمة المرور (حساب المستخدم)</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold text-[10px]">
                {userProfile?.displayName || userProfile?.username || 'المستخدم الحالي'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#859394] mt-0.5">
              تحديث كلمة المرور لحسابك الحالي لحماية بيانات وسجلات العيادة
            </p>
          </div>
        </div>
        <span
          className="material-symbols-outlined text-slate-400 text-2xl transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="p-5 pt-0 border-t border-slate-100 dark:border-white/5 text-xs pt-4 space-y-4">
          {/* User badge banner */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080e1b] border border-slate-200 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-teal-600 dark:text-[#45dee7] text-lg">
                account_circle
              </span>
              <div>
                <p className="font-bold text-slate-800 dark:text-[#dde2f5]">
                  {userProfile?.displayName || userProfile?.username || 'المستخدم'}
                </p>
                <p className="text-[10px] text-slate-400">
                  {userProfile?.email || 'حساب النظام الداخلي'}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-teal-500/15 text-teal-700 dark:text-[#45dee7] font-bold text-[11px]">
              {ROLE_LABELS[role] || role}
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <span className="material-symbols-outlined text-base">error</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1">
              <label className="font-bold text-slate-700 dark:text-[#dde2f5] block">
                كلمة المرور الحالية:
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="أدخل كلمة المرور الحالية..."
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-[#00c2cb] text-xs"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">
                    {showCurrent ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-[#dde2f5] block">
                  كلمة المرور الجديدة (8 خانات فأكثر):
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-[#00c2cb] text-xs"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showNew ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-[#dde2f5] block">
                  تأكيد كلمة المرور الجديدة:
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#18233C] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-[#00c2cb] text-xs"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">
                      {showConfirm ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400">
                يجب ألا تقل كلمة المرور عن 8 أحرف وأرقام لحماية حسابك
              </span>
              <button
                type="submit"
                disabled={busy || !newPassword}
                className="px-5 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">save</span>
                <span>{busy ? 'جاري الحفظ والتحديث...' : 'تحديث كلمة المرور'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
