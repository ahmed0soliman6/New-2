export const BOOKING_LIMITS = {
  nameMin: 6,
  nameMax: 30,
  phoneMin: 7,
  phoneMax: 15,
  notesMax: 500,
  feeMax: 10000,
  windowPastDays: 2,
  windowFutureDays: 30,
} as const;

const AR_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** يحوّل الأرقام العربية والفارسية إلى 0-9 */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(AR_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)));
}

/** مسافات زائدة تُختصر إلى مسافة واحدة */
export function cleanName(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** أرقام فقط بعد إزالة الفواصل والمسافات */
export function cleanPhone(value: string): string {
  return normalizeDigits(value).replace(/[\s\-()+]/g, '');
}

export type BookingField = 'name' | 'phone' | 'branch' | 'date' | 'time' | 'notes' | 'fee';
export type BookingErrors = Partial<Record<BookingField, string>>;

export interface BookingInput {
  name: string;
  phone: string;
  date: string;   // YYYY-MM-DD
  time: string;
  notes: string;
  fee: number;
}

export function validateBooking(input: BookingInput): BookingErrors {
  const errors: BookingErrors = {};

  const name = cleanName(input.name);
  if (name.length < BOOKING_LIMITS.nameMin) {
    errors.name = `الاسم يجب ألا يقل عن ${BOOKING_LIMITS.nameMin} أحرف`;
  } else if (name.length > BOOKING_LIMITS.nameMax) {
    errors.name = `الاسم يجب ألا يزيد عن ${BOOKING_LIMITS.nameMax} حرفًا`;
  } else if (!/\S+\s+\S+/.test(name)) {
    errors.name = 'يرجى كتابة الاسم ثنائيًا على الأقل (الاسم الأول واسم الأب أو العائلة)';
  }

  const phone = cleanPhone(input.phone);
  if (!/^\d{7,15}$/.test(phone)) {
    errors.phone = `رقم الهاتف يجب أن يكون من ${BOOKING_LIMITS.phoneMin} إلى ${BOOKING_LIMITS.phoneMax} رقمًا`;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    errors.date = 'يرجى اختيار تاريخ صالح';
  } else {
    const t = new Date(`${input.date}T00:00:00Z`).getTime();
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    if (Number.isNaN(t)) {
      errors.date = 'يرجى اختيار تاريخ صالح';
    } else if (t < now - BOOKING_LIMITS.windowPastDays * DAY || t > now + BOOKING_LIMITS.windowFutureDays * DAY) {
      errors.date = `التاريخ يجب أن يكون خلال ${BOOKING_LIMITS.windowFutureDays} يومًا قادمة`;
    }
  }

  if (!input.time) errors.time = 'يرجى اختيار وقت الموعد';

  if (input.notes.length > BOOKING_LIMITS.notesMax) {
    errors.notes = `الملاحظات يجب ألا تزيد عن ${BOOKING_LIMITS.notesMax} حرف`;
  }

  if (!Number.isFinite(input.fee) || input.fee < 0 || input.fee > BOOKING_LIMITS.feeMax) {
    errors.fee = `الرسوم يجب أن تكون بين 0 و${BOOKING_LIMITS.feeMax}`;
  }

  return errors;
}
