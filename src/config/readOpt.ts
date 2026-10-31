export const READ_OPT: boolean = (() => {
  try {
    const o = localStorage.getItem('soli_read_opt');
    if (o === '1') return true;
    if (o === '0') return false;
  } catch {
    /* تجاهل أي خطأ في الوصول للـ localStorage */
  }
  // الافتراضي: مفعّل، ويُطفأ فقط إذا ضُبط VITE_READ_OPT=0
  return import.meta.env.VITE_READ_OPT !== '0';
})();

/** عدد الأيام الساخنة (اليوم + السابق). 2 = اليوم والأمس لتغطية ما بعد منتصف الليل */
export const HOT_DAYS: number = Number(import.meta.env.VITE_HOT_DAYS) || 2;

/** نافذة المواعيد الماضية بالأيام */
export const APPT_PAST_DAYS = 7;
