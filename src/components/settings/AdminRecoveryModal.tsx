import React, { useState } from 'react';
import { generateAdminRecoveryCode, setupAdminRecoveryCode } from '../../services/recovery';

interface AdminRecoveryModalProps {
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const AdminRecoveryModal: React.FC<AdminRecoveryModalProps> = ({ onClose, onSuccess }) => {
  const [code, setCode] = useState(() => generateAdminRecoveryCode());
  const [copied, setCopied] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRegenerate = () => {
    setCode(generateAdminRecoveryCode());
    setCopied(false);
  };

  const handleSave = async () => {
    setBusy(true);
    setError('');

    try {
      await setupAdminRecoveryCode({
        recoveryCode: code,
        adminCurrentPassword: adminPass || undefined,
      });
      onSuccess('تم حفظ وتفعيل رمز استرداد المدير بنجاح عبر تشفير PBKDF2 و AES-GCM.');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ رمز الاسترداد.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-purple-500/40 bg-white dark:bg-[#111A2E] p-6 shadow-2xl text-right space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
          <div className="flex items-center gap-2.5 text-purple-600 dark:text-purple-400">
            <span className="material-symbols-outlined text-2xl">encrypted</span>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#dde2f5]">
              رمز استرداد حساب المدير (Admin Recovery Code)
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
          يتيح لك هذا الرمز استعادة الوصول لحساب مدير النظام في حالة نسيان كلمة المرور دون حذف أي بيانات في العيادة.
          يتم حفظ الرمز مشفراً بخوارزمية <strong>PBKDF2 مع 100,000 تكرار</strong> ولا يتم تخزينه كنص واضح إطلاقاً.
        </p>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-base">error</span>
            <span>{error}</span>
          </div>
        )}

        {/* Generated Code Display Box */}
        <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 space-y-2">
          <div className="text-[11px] font-bold text-purple-800 dark:text-purple-300 flex items-center justify-between">
            <span>رمز الاسترداد الآمن الخاص بك:</span>
            <button
              type="button"
              onClick={handleRegenerate}
              className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span className="material-symbols-outlined text-xs">refresh</span>
              <span>توليد رمز جديد</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={code}
              className="flex-1 p-2.5 rounded-lg bg-white dark:bg-[#0c1322] border border-purple-300 dark:border-purple-700/50 font-mono text-sm font-bold text-center tracking-widest text-purple-700 dark:text-purple-300 select-all outline-none"
              dir="ltr"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-sm">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          </div>

          <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold mt-1">
            ⚠️ انسخ هذا الرمز واحفظه في مكان آمن وخاص بك (مثل خزانة كلمات المرور).
          </p>
        </div>

        {/* Optional Current Admin Password */}
        <div>
          <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] block mb-1">
            كلمة مرور المدير الحالية (لربط المحفظة المشفرة):
          </label>
          <input
            type="password"
            placeholder="كلمة مرور حساب المدير الحالية"
            value={adminPass}
            onChange={(e) => setAdminPass(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1322] p-2.5 text-xs focus:ring-1 focus:ring-purple-500 outline-none"
            dir="ltr"
          />
        </div>

        {/* Modal Footer */}
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
            type="button"
            disabled={busy}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all cursor-pointer shadow-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">
              {busy ? 'sync' : 'lock'}
            </span>
            <span>{busy ? 'جارٍ الحفظ والتشفير...' : 'تفعيل وتشفير الرمز في النظام'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
