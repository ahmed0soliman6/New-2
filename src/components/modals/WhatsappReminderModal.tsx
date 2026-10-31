import React, { useState, useEffect, useMemo } from 'react';
import {
  ClinicBranchItem,
  getClinicBranches,
  findBranch,
  buildAppointmentReminderMessage,
  buildFollowupReminderMessage,
} from '../../utils/clinicBranches';

export interface WhatsappReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'appointment' | 'followup';
  patientName: string;
  phone: string;
  timeSlot?: string;
  visitType?: string;
  date?: string;
  dueDate?: string;
  diagnosis?: string;
  initialBranch?: string;
}

export const WhatsappReminderModal: React.FC<WhatsappReminderModalProps> = ({
  isOpen,
  onClose,
  type,
  patientName,
  phone,
  timeSlot,
  visitType,
  date,
  dueDate,
  diagnosis,
  initialBranch,
}) => {
  const branches = useMemo(() => getClinicBranches(), []);

  // Selected branch
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    const matched = findBranch(initialBranch);
    return matched.id;
  });

  // Editable recipient phone (in case patient's phone has typo)
  const [recipientPhone, setRecipientPhone] = useState(phone);

  // Optional custom instructions / notes
  const [customNote, setCustomNote] = useState('');

  // Copied state
  const [copied, setCopied] = useState(false);

  // Re-sync when modal opens with new props
  useEffect(() => {
    if (isOpen) {
      const matched = findBranch(initialBranch);
      setSelectedBranchId(matched.id);
      setRecipientPhone(phone);
      setCustomNote('');
      setCopied(false);
    }
  }, [isOpen, initialBranch, phone]);

  const activeBranch: ClinicBranchItem = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0] || findBranch(initialBranch);
  }, [branches, selectedBranchId, initialBranch]);

  // Formatted preview message
  const messageText = useMemo(() => {
    if (type === 'followup') {
      return buildFollowupReminderMessage({
        patientName,
        dueDate: dueDate || 'الأيام القادمة',
        branch: activeBranch,
        diagnosis,
        customNote,
      });
    }

    return buildAppointmentReminderMessage({
      patientName,
      timeSlot,
      visitType,
      date,
      branch: activeBranch,
      customNote,
    });
  }, [type, patientName, timeSlot, visitType, date, dueDate, diagnosis, activeBranch, customNote]);

  if (!isOpen) return null;

  const cleanPhone = (recipientPhone || '').replace(/[^0-9]/g, '');
  const formattedPhone = cleanPhone.startsWith('0') ? `2${cleanPhone}` : cleanPhone;

  const handleSendWhatsApp = () => {
    if (!cleanPhone) {
      alert('يرجى كتابة أو التأكد من رقم هاتف المريض');
      return;
    }

    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
    try {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch {
      window.location.href = whatsappUrl;
    }
    onClose();
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-[#111A2E] rounded-3xl border border-slate-200 dark:border-white/10 max-w-xl w-full p-5 sm:p-6 space-y-5 shadow-2xl my-auto animate-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/30 flex items-center justify-center font-bold shadow-xs">
              <span className="material-symbols-outlined text-2xl">chat</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {type === 'followup' ? 'إرسال تذكير موعد المتابعة والاستشارة' : 'إرسال تذكير موعد الكشف بالعيادة'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-[#859394]">
                المريض: <strong className="text-slate-800 dark:text-slate-200">{patientName}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Branch Selection & Phone Grid */}
        <div className="space-y-4">
          {/* Branch Picker */}
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-[#00c2cb]">domain</span>
                <span>فرع العيادة المحدد للزيارة والتذكير:</span>
              </span>
              <span className="text-[11px] text-teal-600 dark:text-[#00c2cb] font-semibold">
                حدد الفرع لتضمين عنوانه وهاتفه الصحيح
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {branches.map((b) => {
                const isSelected = b.id === activeBranch.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBranchId(b.id)}
                    className={`p-3 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#00c2cb] bg-teal-500/10 dark:bg-[#00c2cb]/15 ring-2 ring-[#00c2cb]/40'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-[#00c2cb]">location_on</span>
                        <span>{b.name}</span>
                      </span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-[#00c2cb]"></span>
                      )}
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500 dark:text-[#859394] space-y-0.5">
                      {b.address && <p className="line-clamp-1">📍 {b.address}</p>}
                      {b.phone && <p className="font-mono" dir="ltr">📞 {b.phone}</p>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recipient Phone and Custom Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-sm text-[#25D366]">call</span>
                <span>رقم هاتف المريض المستلم:</span>
              </label>
              <input
                type="tel"
                dir="ltr"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 font-mono focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-sm text-[#00c2cb]">note_alt</span>
                <span>تنبيه إضافي للرسالة (اختياري):</span>
              </label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="مثال: يرجى الحضور قبل الموعد بربع ساعة"
                className="w-full bg-slate-50 dark:bg-[#080e1b] text-slate-900 dark:text-[#dde2f5] text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-[#00c2cb]"
              />
            </div>
          </div>

          {/* Live Message Preview Container (Simulating WhatsApp Bubble) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-sm text-emerald-600 dark:text-[#25D366]">visibility</span>
                <span>معاينة نص الرسالة الفعلي (محدث فورياً بالفرع المحدد):</span>
              </label>
              <button
                type="button"
                onClick={handleCopyText}
                className="text-[11px] font-bold text-[#008f97] dark:text-[#00c2cb] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {copied ? 'check' : 'content_copy'}
                </span>
                <span>{copied ? 'تم النسخ بنجاح' : 'نسخ النص'}</span>
              </button>
            </div>

            <div className="bg-[#e5ddd5] dark:bg-[#0b141a] p-4 rounded-2xl border border-slate-200 dark:border-white/10 relative overflow-hidden">
              <div className="max-w-md bg-white dark:bg-[#202c33] text-slate-900 dark:text-[#e9edef] text-xs p-3.5 rounded-2xl rounded-tr-xs shadow-md space-y-1.5 font-sans leading-relaxed whitespace-pre-wrap border border-slate-100 dark:border-white/5">
                {messageText}
                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 dark:text-slate-500 pt-1">
                  <span>الآن</span>
                  <span className="material-symbols-outlined text-xs text-[#53bdeb]">done_all</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-white/5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-[#dde2f5] text-xs font-bold transition-all cursor-pointer"
          >
            إلغاء
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyText}
              className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-700 dark:text-[#dde2f5] text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'تم النسخ' : 'نسخ الرسالة'}</span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsApp}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-[#25D366]/25 hover:shadow-lg hover:shadow-[#25D366]/30 active:scale-95"
            >
              <span className="material-symbols-outlined text-lg">chat</span>
              <span>فتح واتساب وإرسال</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
