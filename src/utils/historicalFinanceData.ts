import { TransactionRecord } from '../types';

// Deterministic seed of 780 visits & transactions for clinical historical records
const PATIENT_FIRST_NAMES = [
  'أحمد', 'محمد', 'محمود', 'علي', 'حسين', 'إبراهيم', 'حسن', 'طارق', 'عمر', 'خالد',
  'كريم', 'يوسف', 'مصطفى', 'سامح', 'شريف', 'هاني', 'عادل', 'سعيد', 'ماجد', 'عمرو',
  'سارة', 'فاطمة', 'مريم', 'نورهان', 'منى', 'رانيا', 'ياسمين', 'هدى', 'دينا', 'نهى',
  'آية', 'سلمى', 'إيمان', 'زينب', 'ريهام', 'بسمة', 'شيرين', 'هالة', 'أميرة', 'نادية'
];

const PATIENT_LAST_NAMES = [
  'الشافعي', 'السيد', 'منصور', 'الصاوي', 'راضي', 'فهمي', 'بدوي', 'عثمان', 'عبد الله',
  'إبراهيم', 'سليمان', 'المهدي', 'القاضي', 'سالم', 'النجار', 'حجازي', 'عوض', 'جلال',
  'عطية', 'خليل', 'حمدي', 'بركات', 'شحاتة', 'سلطان', 'أبو الخير', 'غنيم', 'زايد', 'طاهر'
];

const SERVICES_CATALOG = [
  { name: 'كشف واستشارة طبية', price: 300, weight: 50 },
  { name: 'عمل رسم قلب', price: 150, weight: 15 },
  { name: 'سونار وفحص موجات صوتية', price: 250, weight: 12 },
  { name: 'غيار جروح وتعقيم', price: 100, weight: 8 },
  { name: 'خياطة جرح', price: 200, weight: 5 },
  { name: 'جلسة علاج طبيعي', price: 180, weight: 5 },
  { name: 'عمل جبيرة', price: 250, weight: 3 },
  { name: 'قياس ضغط وسكر وتخطيط سريع', price: 50, weight: 2 },
];

function getRandomService(idx: number) {
  const servicePick = SERVICES_CATALOG[idx % SERVICES_CATALOG.length];
  return servicePick;
}

// Generate deterministic 780 visits across 2026 (September 2026, August, July, etc.)
export function generateHistoricalTransactions(): TransactionRecord[] {
  const records: TransactionRecord[] = [];
  const targetCount = 780;

  // Let's create dates:
  // Sept 1 to Sept 8, 2026: ~130 visits (September 2026)
  // August 2026: ~180 visits
  // July 2026: ~170 visits
  // Jan - June 2026: ~300 visits
  
  for (let i = 1; i <= targetCount; i++) {
    const fn = PATIENT_FIRST_NAMES[(i * 7 + 3) % PATIENT_FIRST_NAMES.length];
    const ln = PATIENT_LAST_NAMES[(i * 13 + 5) % PATIENT_LAST_NAMES.length];
    const patientName = `${fn} ${ln}`;
    const service = getRandomService(i);

    let dateStr = '2026-09-08';
    let monthNum = 9;
    let dayNum = 8;

    if (i <= 130) {
      // September 2026 (1 to 8 Sept)
      dayNum = Math.max(1, 8 - (i % 8));
      const dayPad = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      dateStr = `2026-09-${dayPad}`;
      monthNum = 9;
    } else if (i <= 310) {
      // August 2026
      dayNum = Math.max(1, 31 - ((i - 130) % 31));
      const dayPad = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      dateStr = `2026-08-${dayPad}`;
      monthNum = 8;
    } else if (i <= 480) {
      // July 2026
      dayNum = Math.max(1, 31 - ((i - 310) % 31));
      const dayPad = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      dateStr = `2026-07-${dayPad}`;
      monthNum = 7;
    } else if (i <= 600) {
      // June 2026
      dayNum = Math.max(1, 30 - ((i - 480) % 30));
      const dayPad = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      dateStr = `2026-06-${dayPad}`;
      monthNum = 6;
    } else {
      // Jan - May 2026
      monthNum = Math.max(1, 5 - ((i - 600) % 5));
      dayNum = Math.max(1, 28 - ((i) % 28));
      const monthPad = monthNum < 10 ? `0${monthNum}` : `${monthNum}`;
      const dayPad = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
      dateStr = `2026-${monthPad}-${dayPad}`;
    }

    const hour = 10 + (i % 11);
    const minute = (i * 17) % 60;
    const hour12 = hour > 12 ? hour - 12 : hour;
    const ampm = hour >= 12 ? 'م' : 'ص';
    const minPad = minute < 10 ? `0${minute}` : `${minute}`;
    const timeFormatted = `${hour12 < 10 ? '0' + hour12 : hour12}:${minPad} ${ampm}`;

    const isCard = (i % 5 === 0);
    const isInstapay = (i % 11 === 0);
    const method = isCard ? 'فيزا / كارت' : isInstapay ? 'إنستاباي' : 'نقدي';

    const discount = (i % 15 === 0) ? 50 : 0;
    const totalAmount = service.price;
    const paidAmount = totalAmount - discount;

    records.push({
      id: `hist-tx-${1000 + i}`,
      receiptNo: `REC-${12000 + i}`,
      receiptNumber: `REC-${12000 + i}`,
      patientName,
      serviceName: service.name,
      description: discount > 0 ? `${service.name} (خصم ${discount} ج.م)` : service.name,
      totalAmount,
      discountAmount: discount,
      paidAmount,
      amount: paidAmount,
      type: 'in',
      method,
      paymentMethod: method,
      status: 'مدفوعة',
      time: timeFormatted,
      date: dateStr,
      category: 'كشوفات وخدمات طبية',
    });
  }

  return records;
}

export const BASE_FINANCIAL_METRICS = {
  totalInflowAllPeriods: 175530.0,
  totalOutflowAllPeriods: 55470.0,
  actualNetDrawer: 120060.0,
  inflowSeptember2026: 28050.0,
  outflowSeptember2026: 4620.0,
  balanceEndSeptember2026: 120210.0,
  totalVisitsCount: 780,
};
