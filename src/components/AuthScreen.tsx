import React, { useState } from 'react';
import { firebaseConfigError } from '../services/firebase';
import { loginWithUsername } from '../services/auth';
import { AdminRecoveryDialog } from './auth/AdminRecoveryDialog';
import { SoliMedicalLogo } from './SoliMedicalLogo';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';
import { useLanguage } from '../i18n/LanguageContext';

export const AuthScreen: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [showPwaModal, setShowPwaModal] = useState(false);

  const { language, toggleLanguage, dir, t } = useLanguage();
  const { isInstalled, canInstallPrompt, installApp } = usePWAInstall();

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccessMessage('');
    setBusy(true);
    try {
      await loginWithUsername(username, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'اسم المستخدم أو كلمة المرور غير صحيحة.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickFill = (user: string) => {
    setUsername(user);
    setError('');
  };

  return (
    <main dir={dir} className="min-h-screen bg-[#050a14] text-[#dde2f5] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden selection:bg-[#00c2cb]/30 selection:text-[#00c2cb]">
      {/* Top Bar language toggle */}
      <div className="absolute top-4 right-4 z-20">
        <button
          type="button"
          onClick={toggleLanguage}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0c1524]/80 hover:bg-[#162338] text-[#45dee7] border border-[#00c2cb]/30 transition-all cursor-pointer text-xs font-bold shadow-lg active:scale-95"
          title={language === 'en' ? 'التحويل للعربية (Switch to Arabic)' : 'التحويل للإنجليزية (Switch to English)'}
        >
          <span className="material-symbols-outlined text-base">translate</span>
          <span className="font-mono text-xs">{language === 'ar' ? 'AR' : 'EN'}</span>
        </button>
      </div>

      {/* Background Decorative Ambient Glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#00c2cb]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-cyan-600/10 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-5 relative z-10">
        {/* Top Brand Hero Section */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="animate-pulse-subtle">
            <SoliMedicalLogo size="xl" showText={false} glow={true} />
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
              <span>Soli Medical Clinic</span>
            </h1>
            <p className="text-xs text-[#859394] pt-1">
              نظام إدارة العيادة الذكي والملف الطبي الموحد
            </p>
          </div>
        </div>

        {/* Login Form Container */}
        <form
          onSubmit={submit}
          className="rounded-3xl bg-[#0c1524]/90 border border-[#00c2cb]/30 p-6 sm:p-8 shadow-2xl shadow-black/80 backdrop-blur-xl space-y-5"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00c2cb] text-xl">lock</span>
              <h2 className="text-base font-bold text-white">تسجيل الدخول للنظام</h2>
            </div>
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#00c2cb]/10 text-[#45dee7] border border-[#00c2cb]/30 font-bold">
              v2.6 RBAC
            </span>
          </div>

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">اسم المستخدم</label>
            <div className="flex items-center gap-2.5">
              <div className="w-11 h-11 shrink-0 rounded-2xl bg-[#050a14] border border-white/10 flex items-center justify-center text-[#00c2cb] pointer-events-none">
                <span className="material-symbols-outlined text-lg">
                  person
                </span>
              </div>
              <input
                required
                pattern="[A-Za-z0-9._-]{3,32}"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                placeholder="ادخل اسم المستخدم..."
                dir="ltr"
                className="flex-1 min-w-0 rounded-2xl bg-[#050a14] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none border border-white/10 focus:border-[#00c2cb] focus:ring-1 focus:ring-[#00c2cb] transition-all"
              />
            </div>
          </div>

          {/* Password Input with External Show/Hide Toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-300">كلمة المرور</label>
              <button
                type="button"
                onClick={() => setShowRecoveryDialog(true)}
                className="text-[11px] text-[#00c2cb] hover:underline cursor-pointer"
              >
                استرداد رمز المدير؟
              </button>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="w-11 h-11 shrink-0 rounded-2xl bg-[#050a14] hover:bg-[#162338] border border-white/10 hover:border-[#00c2cb]/50 text-slate-300 hover:text-[#00c2cb] transition-colors cursor-pointer flex items-center justify-center"
                title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                <span className="material-symbols-outlined text-lg">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
              <input
                required
                minLength={8}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                className="flex-1 min-w-0 rounded-2xl bg-[#050a14] px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none border border-white/10 focus:border-[#00c2cb] focus:ring-1 focus:ring-[#00c2cb] transition-all"
              />
            </div>
          </div>

          {/* Status Messages */}
          {firebaseConfigError && (
            <p className="text-amber-300 text-xs leading-6 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              {firebaseConfigError}
            </p>
          )}

          {error && (
            <p className="text-rose-300 text-xs leading-6 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
              {error}
            </p>
          )}

          {successMessage && (
            <p className="text-emerald-300 text-xs leading-6 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              {successMessage}
            </p>
          )}

          {/* Login Submit Button */}
          <button
            type="submit"
            disabled={busy || !!firebaseConfigError}
            className="w-full py-3.5 rounded-2xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-extrabold text-sm shadow-lg shadow-[#00c2cb]/25 transition-all cursor-pointer active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-xl">login</span>
            <span>{busy ? 'جارٍ التحقق وتأكيد الدخول...' : 'تسجيل الدخول'}</span>
          </button>
        </form>

        {/* PWA Install Button Banner */}
        <div className="bg-[#0c1524]/80 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-[#00c2cb] text-2xl shrink-0">mobile_friendly</span>
            <div className="min-w-0 flex flex-col">
              <span className="font-bold text-white text-xs truncate">تطبيق سولي ميديكال الويب (PWA)</span>
              <span className="text-[11px] text-slate-400 truncate">قابل للتثبيت على الأندرويد، الآيفون، والكمبيوتر</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              if (canInstallPrompt) {
                await installApp();
              } else {
                setShowPwaModal(true);
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-[#00c2cb]/20 hover:bg-[#00c2cb] text-[#45dee7] hover:text-slate-950 border border-[#00c2cb]/40 font-bold transition-all cursor-pointer shrink-0 text-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>{isInstalled ? 'مثبّت كـ تطبيق ✓' : 'تثبيت التطبيق'}</span>
          </button>
        </div>

        {/* Security Footer Note */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <p>© 2026 Soli Medical Clinic Systems. جميع الحقوق محفوظة.</p>
          <p>نظام محمي بتشفر الأمان والتحكم الدقيق بالصلاحيات (RBAC)</p>
        </div>
      </div>

      {showRecoveryDialog && (
        <AdminRecoveryDialog
          onClose={() => setShowRecoveryDialog(false)}
          onSuccess={(msg) => {
            setSuccessMessage(msg);
            setShowRecoveryDialog(false);
          }}
        />
      )}

      {/* PWA Installation Modal */}
      <PWAInstallModal isOpen={showPwaModal} onClose={() => setShowPwaModal(false)} />
    </main>
  );
};
