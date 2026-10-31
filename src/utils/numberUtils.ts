/**
 * Number & Digit Standardizer Utilities
 * Ensures all numbers, dates, times, currency, invoices, and phone numbers
 * consistently appear and process in standard English digits (0, 1, 2, 3, 4, 5, 6, 7, 8, 9).
 * Automatically converts Arabic/Indic digits (٠-٩) entered by users to English digits.
 */

const ARABIC_INDIC_DIGITS_MAP: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

const ARABIC_DIGITS_REGEX = /[٠-٩۰-۹]/g;

/**
 * Converts any Arabic/Persian Indic digits in a string or number to standard English digits (0-9).
 * Safe for null, undefined, numbers, and strings.
 */
export function toEnglishDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  const str = String(input);
  if (!str) return '';
  return str.replace(ARABIC_DIGITS_REGEX, (char) => ARABIC_INDIC_DIGITS_MAP[char] || char);
}

/**
 * Alias requested by user for converting Arabic numbers to English numbers
 */
export const convertArabicToEnglishDigits = toEnglishDigits;

/**
 * Formats a date using proper locale (en-US or ar-EG) with strict English numerals (0-9)
 */
export function formatAppDate(
  dateInput: string | Date | number | null | undefined,
  optionsOrLang?: Intl.DateTimeFormatOptions | string,
  lang?: string
): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) {
      return toEnglishDigits(String(dateInput));
    }
    const options = typeof optionsOrLang === 'object' ? optionsOrLang : undefined;
    const explicitLang = typeof optionsOrLang === 'string' ? optionsOrLang : lang;
    const currentLang = explicitLang || (typeof window !== 'undefined' ? localStorage.getItem('clinic_language') : 'ar') || 'ar';
    const locale = currentLang === 'en' ? 'en-US' : 'ar-EG-u-nu-latn';
    const formatted = d.toLocaleDateString(locale, options || {
      day: 'numeric',
      month: currentLang === 'en' ? 'short' : 'long',
      year: 'numeric',
    });
    return toEnglishDigits(formatted);
  } catch {
    return toEnglishDigits(String(dateInput));
  }
}

/**
 * Formats a time string or Date object with proper locale and strict English numerals (0-9)
 */
export function formatAppTime(
  dateInput: string | Date | number | null | undefined,
  optionsOrLang?: Intl.DateTimeFormatOptions | string,
  lang?: string
): string {
  if (!dateInput) return '';
  try {
    const d = typeof dateInput === 'string' || typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) {
      return toEnglishDigits(String(dateInput));
    }
    const options = typeof optionsOrLang === 'object' ? optionsOrLang : undefined;
    const explicitLang = typeof optionsOrLang === 'string' ? optionsOrLang : lang;
    const currentLang = explicitLang || (typeof window !== 'undefined' ? localStorage.getItem('clinic_language') : 'ar') || 'ar';
    const locale = currentLang === 'en' ? 'en-US' : 'ar-EG-u-nu-latn';
    const formatted = d.toLocaleTimeString(locale, options || {
      hour: '2-digit',
      minute: '2-digit',
    });
    return toEnglishDigits(formatted);
  } catch {
    return toEnglishDigits(String(dateInput));
  }
}

/**
 * Global input interceptor:
 * Automatically converts any Arabic/Indic numerals to English numerals in all input fields
 * across the entire application in real-time as the user types or pastes.
 */
export function initArabicToEnglishDigitsGlobalListener(): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleInputEvent = (e: Event) => {
    const target = e.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
    ) {
      const val = target.value;
      if (val && ARABIC_DIGITS_REGEX.test(val)) {
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const converted = toEnglishDigits(val);
        target.value = converted;
        if (start !== null && end !== null) {
          try {
            target.setSelectionRange(start, end);
          } catch {
            // Some input types like number or email might disallow setSelectionRange
          }
        }
      }
    }
  };

  const handleBeforeInput = (e: any) => {
    if (e.data && ARABIC_DIGITS_REGEX.test(e.data)) {
      const convertedData = toEnglishDigits(e.data);
      // If execCommand is supported or insertText, we can insert the converted text
      const target = e.target;
      if (
        (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
        !e.defaultPrevented
      ) {
        // Let standard input fire, then handleInputEvent cleans it up
      }
    }
  };

  // Attach capture listener so it fires before React synthetic events
  document.addEventListener('input', handleInputEvent, true);
  document.addEventListener('beforeinput', handleBeforeInput, true);
  document.addEventListener('paste', handleInputEvent, true);

  return () => {
    document.removeEventListener('input', handleInputEvent, true);
    document.removeEventListener('beforeinput', handleBeforeInput, true);
    document.removeEventListener('paste', handleInputEvent, true);
  };
}
