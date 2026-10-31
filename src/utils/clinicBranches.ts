import { CLINIC_INFO } from '../data/previewClinicData';
import { safeStorage, StorageKeys } from '../services/storage';
import { getPrescriptionDoctorInfo } from './prescriptionDoctor';

export interface ClinicBranchItem {
  id: string;
  name: string;
  address: string;
  phone: string;
  mobile?: string;
  workingHours?: string;
  startTime?: string; // e.g., "16:00" or "04:00 م"
  endTime?: string;   // e.g., "22:00" or "10:00 م"
}

export function formatBranchTime(timeStr?: string): string {
  if (!timeStr) return '';
  if (timeStr.includes('ص') || timeStr.includes('م')) return timeStr;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] !== undefined ? parseInt(parts[1], 10) : 0;
  if (isNaN(h)) return timeStr;
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 || 12;
  const minFormatted = !isNaN(m) && m > 0 ? `:${m < 10 ? '0' + m : m}` : ':00';
  return `${hour12 < 10 ? '0' + hour12 : hour12}${minFormatted} ${period}`;
}

/**
 * Generates 48 time options (every 30 mins) for a 24-hour day to allow full day selection.
 */
export function generateAllDayTimeOptions(): { value: string; label: string }[] {
  const options = [];
  for (let h = 0; h < 24; h++) {
    for (let m of [0, 30]) {
      const hh = h < 10 ? `0${h}` : `${h}`;
      const mm = m === 0 ? '00' : '30';
      const value = `${hh}:${mm}`;
      
      let label = '';
      const h12 = h % 12 || 12;
      const h12Str = h12 < 10 ? `0${h12}` : `${h12}`;
      
      if (h === 0 && m === 0) {
        label = '12:00 منتصف الليل (12:00 ص)';
      } else if (h === 0 && m === 30) {
        label = '12:30 بعد منتصف الليل (12:30 ص)';
      } else if (h === 12 && m === 0) {
        label = '12:00 ظهراً (12:00 م)';
      } else if (h === 12 && m === 30) {
        label = '12:30 بعد الظهر (12:30 م)';
      } else {
        const period = h >= 12 ? 'مساءً (م)' : 'صباحاً (ص)';
        label = `${h12Str}:${mm} ${period}`;
      }
      options.push({ value, label });
    }
  }
  return options;
}

/**
 * Intelligent helper to extract start & end times from a working hours string if explicit times are not provided.
 * e.g., "الأحد، الثلاثاء، الخميس 06:00 م - 11:30 م" -> { startTime: "18:00", endTime: "23:30" }
 */
export function extractTimesFromWorkingHours(workingHours?: string): { startTime?: string; endTime?: string } | null {
  if (!workingHours) return null;

  // Regex to match patterns like "06:00 م - 11:30 م" or "04:00م - 10:00م" or "18:00 إلى 23:30"
  const matches = workingHours.match(/(\d{1,2}(?::\d{2})?\s*(?:ص|م|AM|PM|am|pm)?)\s*[-–إلى]\s*(\d{1,2}(?::\d{2})?\s*(?:ص|م|AM|PM|am|pm)?)/i);
  if (!matches || !matches[1] || !matches[2]) return null;

  const parseTo24h = (str: string): string | null => {
    const s = str.trim().toLowerCase();
    const isPM = s.includes('م') || s.includes('pm');
    const isAM = s.includes('ص') || s.includes('am');
    const digitsOnly = s.replace(/[^\d:]/g, '');
    const parts = digitsOnly.split(':');
    if (parts.length < 1) return null;
    let h = parseInt(parts[0], 10);
    let m = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
    if (isNaN(h)) return null;
    if (isNaN(m)) m = 0;

    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;

    return `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
  };

  const start = parseTo24h(matches[1]);
  const end = parseTo24h(matches[2]);

  if (start && end) {
    return { startTime: start, endTime: end };
  }
  return null;
}

/**
 * Generates available 15-minute time slots between a branch's startTime and endTime.
 */
export function generateBranchTimeSlots(
  startTime?: string,
  endTime?: string,
  workingHours?: string
): { raw: string; label: string }[] {
  let effectiveStart = startTime;
  let effectiveEnd = endTime;

  // If start/end times seem unconfigured or default 16:00-22:00, check if workingHours has explicit custom times
  if ((!effectiveStart || !effectiveEnd || (effectiveStart === '16:00' && effectiveEnd === '22:00')) && workingHours) {
    const parsed = extractTimesFromWorkingHours(workingHours);
    if (parsed && parsed.startTime && parsed.endTime) {
      effectiveStart = parsed.startTime;
      effectiveEnd = parsed.endTime;
    }
  }

  const parseMins = (str?: string, fallbackMins: number = 0): number => {
    if (!str) return fallbackMins;
    const s = str.trim().toLowerCase();
    const isPM = s.includes('م') || s.includes('pm');
    const isAM = s.includes('ص') || s.includes('am');
    const digitsOnly = s.replace(/[^\d:]/g, '');
    const parts = digitsOnly.split(':');
    if (parts.length < 1) return fallbackMins;
    let h = parseInt(parts[0], 10);
    let m = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
    if (isNaN(h)) return fallbackMins;
    if (isNaN(m)) m = 0;

    if (isPM && h < 12) h += 12;
    if (isAM && h === 12) h = 0;

    return h * 60 + m;
  };

  const startMins = parseMins(effectiveStart, 16 * 60); // Default 4:00 PM (16:00)
  let endMins = parseMins(effectiveEnd, 22 * 60);       // Default 10:00 PM (22:00)

  if (endMins <= startMins) {
    endMins += 24 * 60;
  }

  const slots: { raw: string; label: string }[] = [];
  const step = 15; // 15-minute slots as requested by user

  for (let mins = startMins; mins <= endMins; mins += step) {
    const norm = mins % (24 * 60);
    const h = Math.floor(norm / 60);
    const m = norm % 60;

    const rawStr = `${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
    const period = h >= 12 ? 'م' : 'ص';
    const h12 = h % 12 || 12;
    const labelStr = `${h12 < 10 ? '0' + h12 : h12}:${m < 10 ? '0' + m : m} ${period}`;

    slots.push({ raw: rawStr, label: labelStr });
  }

  return slots;
}

/**
 * Returns all active branches configured in the clinic.
 * Prioritizes user settings saved in localStorage (`soli_clinic_branches` or `soli_prescription_settings`),
 * falling back to `CLINIC_INFO.branches`.
 */
export function getClinicBranches(): ClinicBranchItem[] {
  const customBranches = safeStorage.getJSON<any[] | null>(StorageKeys.CLINIC_BRANCHES, null);
  if (Array.isArray(customBranches) && customBranches.length > 0) {
    return customBranches.map((b: any, index: number) => {
      const parsed = extractTimesFromWorkingHours(b.workingHours);
      return {
        id: b.id || `branch-${index}`,
        name: b.name || `فرع ${index + 1}`,
        address: b.address || '',
        phone: b.phone || b.mobile || '',
        mobile: b.mobile || b.phone || '',
        workingHours: b.workingHours || '',
        startTime: b.startTime || parsed?.startTime || '16:00',
        endTime: b.endTime || parsed?.endTime || '22:00',
      };
    });
  }

  const cached = safeStorage.getJSON<any | null>(StorageKeys.PRESCRIPTION_SETTINGS, null);
  if (cached && Array.isArray(cached.branches) && cached.branches.length > 0) {
    return cached.branches.map((b: any, index: number) => {
      const parsed = extractTimesFromWorkingHours(b.workingHours);
      return {
        id: b.id || `branch-${index}`,
        name: b.name || `فرع ${index + 1}`,
        address: b.address || '',
        phone: b.phone || b.mobile || '',
        mobile: b.mobile || b.phone || '',
        workingHours: b.workingHours || '',
        startTime: b.startTime || parsed?.startTime || '16:00',
        endTime: b.endTime || parsed?.endTime || '22:00',
      };
    });
  }

  // Fallback to CLINIC_INFO.branches
  if (Array.isArray(CLINIC_INFO.branches) && CLINIC_INFO.branches.length > 0) {
    return CLINIC_INFO.branches.map((b) => {
      const workingHours = b.hours ? `${b.days ? b.days + ' ' : ''}${b.hours}` : '';
      const parsed = extractTimesFromWorkingHours(workingHours);
      return {
        id: b.id,
        name: b.name,
        address: b.address,
        phone: b.phone || b.mobile || '',
        mobile: b.mobile || b.phone || '',
        workingHours,
        startTime: parsed?.startTime || (b.id === 'dokki' ? '18:00' : '16:00'),
        endTime: parsed?.endTime || (b.id === 'dokki' ? '23:30' : '22:00'),
      };
    });
  }

  return [
    {
      id: 'default-1',
      name: 'الفرع الرئيسي',
      address: 'العنوان الرئيسي للعيادة',
      phone: '01092847162',
      mobile: '01092847162',
      workingHours: 'يومياً ما عدا الجمعة (04:00 م - 10:00 م)',
      startTime: '16:00',
      endTime: '22:00',
    },
  ];
}

/**
 * Saves clinic branches to localStorage and syncs with prescription settings.
 * Dispatches an update event so all screens re-render instantaneously.
 */
export function saveClinicBranches(branches: ClinicBranchItem[]): void {
  safeStorage.setJSON(StorageKeys.CLINIC_BRANCHES, branches);

  // Also update branches in prescription settings if present
  const cachedRx = safeStorage.getJSON<any | null>(StorageKeys.PRESCRIPTION_SETTINGS, null);
  if (cachedRx) {
    cachedRx.branches = branches.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone || b.mobile || '',
      workingHours: b.workingHours || '',
      startTime: b.startTime || '16:00',
      endTime: b.endTime || '22:00',
    }));
    safeStorage.setJSON(StorageKeys.PRESCRIPTION_SETTINGS, cachedRx);
  }

  window.dispatchEvent(new CustomEvent('soli_branches_updated', { detail: branches }));
  window.dispatchEvent(new Event('soli_prescription_updated'));
  window.dispatchEvent(new Event('storage'));
}

/**
 * Finds the matching branch by ID or by partial name match.
 * If not found, returns the first branch.
 */
export function findBranch(identifier?: string): ClinicBranchItem {
  const branches = getClinicBranches();
  if (!branches.length) {
    return {
      id: 'default-1',
      name: 'الفرع الرئيسي',
      address: 'العنوان الرئيسي للعيادة',
      phone: '01092847162',
      mobile: '01092847162',
    };
  }

  if (!identifier || !identifier.trim()) {
    return branches[0];
  }

  const clean = identifier.trim().toLowerCase();

  // Match by exact id
  const byId = branches.find((b) => b.id.toLowerCase() === clean);
  if (byId) return byId;

  // Match by exact or partial name
  const byName = branches.find((b) => {
    const bName = b.name.toLowerCase();
    return bName.includes(clean) || clean.includes(bName);
  });
  if (byName) return byName;

  // Specific common keywords (e.g. مهندسين vs دقي)
  if (clean.includes('مهندس') || clean.includes('رئيسي')) {
    const found = branches.find((b) => b.name.includes('مهندس') || b.name.includes('رئيسي'));
    if (found) return found;
  }
  if (clean.includes('دقي')) {
    const found = branches.find((b) => b.name.includes('دقي'));
    if (found) return found;
  }

  return branches[0];
}

/**
 * Builds a dynamic, accurate WhatsApp reminder message for a scheduled appointment.
 */
export function buildAppointmentReminderMessage(params: {
  patientName: string;
  timeSlot?: string;
  visitType?: string;
  branch: ClinicBranchItem;
  date?: string;
  customNote?: string;
}): string {
  const doctor = getPrescriptionDoctorInfo();
  const doctorName = doctor.doctorName || CLINIC_INFO.doctorName;
  const time = params.timeSlot || '09:00 ص';
  const visitType = params.visitType || 'كشف';
  const branch = params.branch;
  const contactPhone = branch.phone || branch.mobile || doctor.phone || '01092847162';

  let dateLine = '';
  if (params.date) {
    dateLine = `🗓 موعد الحجز: *${params.date}* في تمام *${time}* (${visitType})`;
  } else {
    dateLine = `🗓 موعد الحجز: *${time}* (${visitType})`;
  }

  let addressLine = `📍 فرع العيادة: *${branch.name}*`;
  if (branch.address) {
    addressLine += `\nالعنوان: ${branch.address}`;
  }
  if (branch.workingHours) {
    addressLine += `\n⏰ مواعيد العمل: ${branch.workingHours}`;
  }

  const noteLine = params.customNote?.trim() ? `\n💡 تنبيه: ${params.customNote.trim()}` : '';

  return `مرحباً بحضرتك أستاذ/ة *${params.patientName}* 🌸
نود تذكيركم بموعدكم في *عيادة ${doctorName}* 🩺
${dateLine}
${addressLine}
📞 للتأكيد أو تعديل الموعد: ${contactPhone}${noteLine}
مع تمنياتنا لكم بدوام الصحة والعافية ✨`;
}

/**
 * Builds a dynamic, accurate WhatsApp reminder message for a follow-up consultation.
 */
export function buildFollowupReminderMessage(params: {
  patientName: string;
  dueDate: string;
  branch: ClinicBranchItem;
  diagnosis?: string;
  customNote?: string;
}): string {
  const doctor = getPrescriptionDoctorInfo();
  const doctorName = doctor.doctorName || CLINIC_INFO.doctorName;
  const branch = params.branch;
  const contactPhone = branch.phone || branch.mobile || doctor.phone || '01092847162';

  let addressLine = `📍 فرع العيادة: *${branch.name}*`;
  if (branch.address) {
    addressLine += `\nالعنوان: ${branch.address}`;
  }
  if (branch.workingHours) {
    addressLine += `\n⏰ مواعيد العمل: ${branch.workingHours}`;
  }

  const diagLine = params.diagnosis ? `\n🩺 بخصوص: ${params.diagnosis}` : '';
  const noteLine = params.customNote?.trim() ? `\n💡 تنبيه: ${params.customNote.trim()}` : '';

  return `مرحباً بحضرتك أستاذ/ة *${params.patientName}* 🌸
نود تذكيركم بموعد المتابعة والاستشارة الطبية المحدد لكم في *عيادة ${doctorName}* 🩺
🗓 موعد المتابعة: *${params.dueDate}*${diagLine}
${addressLine}
📞 للتأكيد أو الاستفسار: ${contactPhone}${noteLine}
مع تمنياتنا لكم بدوام الصحة والعافية ✨`;
}

/**
 * Checks if a selected date is a valid working day according to the branch's workingHours string.
 * Returns true if valid, false if the clinic is closed on that day of the week.
 */
export function isDateMatchingBranchDays(dateStr: string, workingHours?: string): boolean {
  if (!dateStr || !workingHours) return true;

  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return true; // fallback to true if invalid date string

  const dayIndex = dateObj.getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday

  const text = workingHours.toLowerCase();

  // 1. "يومياً ما عدا الجمعة" or "ما عدا الجمعة" -> All days except Friday (5)
  if (text.includes('ما عدا الجمعة') || text.includes('عدا الجمعة')) {
    return dayIndex !== 5;
  }

  // 2. "من السبت إلى الخميس" -> All days except Friday (5)
  if (text.includes('من السبت إلى الخميس') || text.includes('من السبت الى الخميس')) {
    return dayIndex !== 5;
  }

  // 3. "يومياً" or "طوال أيام الأسبوع" -> All days valid
  if (text.includes('يوميا') || text.includes('طوال') || text.includes('طوال أيام الأسبوع')) {
    return true;
  }

  // 4. Specific days list (e.g. "الأحد، الثلاثاء، الخميس")
  // Let's see if the text contains any of the standard Arabic day names.
  const daysInText = {
    sunday: text.includes('أحد') || text.includes('احد'),
    monday: text.includes('إثنين') || text.includes('اثنين'),
    tuesday: text.includes('ثلاثاء'),
    wednesday: text.includes('أربعاء') || text.includes('اربعاء'),
    thursday: text.includes('خميس'),
    friday: text.includes('جمعة'),
    saturday: text.includes('سبت'),
  };

  // If the text contains at least one explicit day name, restrict to those explicitly mentioned days.
  const hasExplicitDays = Object.values(daysInText).some(val => val === true);
  if (hasExplicitDays) {
    if (dayIndex === 0) return daysInText.sunday;
    if (dayIndex === 1) return daysInText.monday;
    if (dayIndex === 2) return daysInText.tuesday;
    if (dayIndex === 3) return daysInText.wednesday;
    if (dayIndex === 4) return daysInText.thursday;
    if (dayIndex === 5) return daysInText.friday;
    if (dayIndex === 6) return daysInText.saturday;
  }

  return true; // Fallback default
}

/**
 * Calculates the nearest future date (starting from today or a given date) that matches the branch's working days.
 */
export function getNextValidWorkingDate(startDateStr: string, workingHours?: string): string {
  if (!startDateStr || !workingHours) return startDateStr;

  let current = new Date(startDateStr);
  if (isNaN(current.getTime())) return startDateStr;

  // Max lookahead of 30 days to prevent infinite loops
  for (let i = 0; i < 30; i++) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    if (isDateMatchingBranchDays(dateStr, workingHours)) {
      return dateStr;
    }
    current.setDate(current.getDate() + 1);
  }

  return startDateStr;
}

export interface UpcomingDateSuggestion {
  dateStr: string; // YYYY-MM-DD
  dayLabel: string; // "الخميس ١٧ سبتمبر" or "الخميس 17/09"
}

/**
 * Returns the next 3 available kashf dates for quick selection.
 */
export function getUpcomingDateSuggestions(workingHours?: string): UpcomingDateSuggestion[] {
  const suggestions: UpcomingDateSuggestion[] = [];
  let current = new Date(); // Start from today
  
  // Format helpers
  const arabicMonths = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const arabicWeekDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  // Look ahead up to 60 days to collect 3 matching dates
  for (let i = 0; i < 60 && suggestions.length < 3; i++) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    if (isDateMatchingBranchDays(dateStr, workingHours)) {
      const dayName = arabicWeekDays[current.getDay()];
      const dayNum = current.getDate();
      const monthName = arabicMonths[current.getMonth()];
      suggestions.push({
        dateStr,
        dayLabel: `${dayName} ${dayNum} ${monthName}`,
      });
    }
    current.setDate(current.getDate() + 1);
  }

  return suggestions;
}
