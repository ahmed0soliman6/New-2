import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstalled, isIOS, canInstallPrompt, installApp } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'desktop' | 'android' | 'ios'>(() => {
    if (isIOS) return 'ios';
    const userAgent = navigator.userAgent.toLowerCase();
    if (/android/.test(userAgent)) return 'android';
    return 'desktop';
  });

  if (!isOpen) return null;

  const isInIframe = window.self !== window.top;

  const handleOpenInNewTab = () => {
    window.open(window.location.origin + window.location.pathname, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn" dir="rtl">
      <div className="relative w-full max-w-lg bg-[#0e172a] border border-[#00c2cb]/30 rounded-2xl shadow-2xl overflow-hidden text-slate-100 my-auto">
        {/* Header decoration bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#00c2cb] via-sky-400 to-indigo-500 w-full" />

        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          title="إغلاق"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>

        <div className="p-6">
          {/* App Branding & Icon */}
          <div className="flex items-center gap-4 mb-6">
            <div className="relative w-16 h-16 rounded-2xl bg-[#080f1e] p-2 border border-[#00c2cb]/40 shadow-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
              <img src="/pwa-192x192.png" alt="Soli Medical Icon" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">تثبيت تطبيق سولي ميديكال</h3>
                {isInstalled && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    مثبّت ✓
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                تطبيق الويب المستقل للعيادة - يعمل بدون شريط المتصفح وعلى كافة الأجهزة
              </p>
            </div>
          </div>

          {/* Direct Native Install Button */}
          {canInstallPrompt && !isInstalled ? (
            <div className="mb-6">
              <button
                onClick={async () => {
                  await installApp();
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#00c2cb] to-sky-500 hover:from-[#00c2cb]/90 hover:to-sky-400 text-[#08101C] font-extrabold rounded-xl shadow-lg shadow-[#00c2cb]/20 flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer"
              >
                <span className="material-symbols-outlined text-2xl">download</span>
                <span className="text-base">تثبيت التطبيق بنقرة واحدة الآن</span>
              </button>
            </div>
          ) : isInIframe ? (
            <div className="mb-6 p-3.5 rounded-xl bg-[#18233C] border border-cyan-500/30 flex items-center justify-between gap-3">
              <div className="text-xs text-cyan-200">
                أنت الآن داخل معاينة الـ iframe. للتثبيت المباشر افتح التطبيق في نافذة خاصة.
              </div>
              <button
                onClick={handleOpenInNewTab}
                className="px-3.5 py-2 bg-[#00c2cb] text-[#08101C] font-bold text-xs rounded-lg hover:bg-[#00c2cb]/90 transition-colors shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                <span>فتح بالمتصفح</span>
              </button>
            </div>
          ) : null}

          {/* Platform Tab selector */}
          <div className="flex border-b border-slate-800 mb-4">
            <button
              onClick={() => setActiveTab('desktop')}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'desktop'
                  ? 'border-[#00c2cb] text-[#00c2cb]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-base">desktop_windows</span>
              <span>الكمبيوتر (Windows / Mac)</span>
            </button>
            <button
              onClick={() => setActiveTab('android')}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'android'
                  ? 'border-[#00c2cb] text-[#00c2cb]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-base">android</span>
              <span>أندرويد (Android)</span>
            </button>
            <button
              onClick={() => setActiveTab('ios')}
              className={`flex-1 py-2.5 text-xs font-bold transition-colors border-b-2 flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'ios'
                  ? 'border-[#00c2cb] text-[#00c2cb]'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="material-symbols-outlined text-base">phone_iphone</span>
              <span>آيفون وآيباد (iOS)</span>
            </button>
          </div>

          {/* Instructions Step By Step */}
          <div className="bg-[#111A2E] rounded-xl p-4 border border-slate-800/80 text-xs text-slate-300 space-y-3">
            {activeTab === 'desktop' && (
              <>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#00c2cb]/20 text-[#00c2cb] font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </span>
                  <p>
                    في متصفح <strong>Google Chrome</strong> أو <strong>Microsoft Edge</strong>، اضغط على زر التثبيت بالأعلى.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#00c2cb]/20 text-[#00c2cb] font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </span>
                  <p className="flex items-center gap-1 flex-wrap">
                    أو اضغط على أيقونة التثبيت <span className="material-symbols-outlined text-sky-400 inline">download_for_offline</span> بجانب شريط عنوان الرابط (URL) في الأعلى.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#00c2cb]/20 text-[#00c2cb] font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </span>
                  <p>
                    اضغط <strong>تثبيت (Install)</strong> لتجد أيقونة التطبيق أضيفت على سطح المكتب وقائمة ابدأ.
                  </p>
                </div>
              </>
            )}

            {activeTab === 'android' && (
              <>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#00c2cb]/20 text-[#00c2cb] font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </span>
                  <p>افتح الموقع باستخدام متصفح <strong>Chrome</strong> أو <strong>Samsung Internet</strong>.</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#00c2cb]/20 text-[#00c2cb] font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </span>
                  <p className="flex items-center gap-1 flex-wrap">
                    اضغط زر القائمة <strong>(⋮)</strong> في شريط المتصفح العلوي.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#00c2cb]/20 text-[#00c2cb] font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </span>
                  <p>
                    اختر <strong>تثبيت التطبيق (Install app)</strong> أو <strong>الإضافة إلى الشاشة الرئيسية</strong>.
                  </p>
                </div>
              </>
            )}

            {activeTab === 'ios' && (
              <>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#00c2cb]/20 text-[#00c2cb] font-bold flex items-center justify-center shrink-0 text-xs">
                    1
                  </span>
                  <p>
                    افتح الرابط في متصفح Safari الرسمي على جهاز الـ iPhone أو iPad.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#00c2cb]/20 text-[#00c2cb] font-bold flex items-center justify-center shrink-0 text-xs">
                    2
                  </span>
                  <p className="flex items-center gap-1 flex-wrap">
                    اضغط على زر المشاركة <strong>Share</strong>
                    <span className="material-symbols-outlined text-sky-400 inline">ios_share</span>
                    أسفل أو أعلى شاشة المتصفح.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-[#00c2cb]/20 text-[#00c2cb] font-bold flex items-center justify-center shrink-0 text-xs">
                    3
                  </span>
                  <p className="flex items-center gap-1 flex-wrap">
                    اختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>
                    <span className="material-symbols-outlined text-[#00c2cb] inline">add_box</span>
                    ثم اضغط <strong>إضافة (Add)</strong>.
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Footer Action */}
          <div className="mt-6 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              حسناً، فهمت
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
