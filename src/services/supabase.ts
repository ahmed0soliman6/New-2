import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Single source of truth for Supabase configuration across Soli Medical.
 * Loaded from Vite environment variables (VITE_SUPABASE_* and VITE_CLINIC_SLUG).
 */
export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL?.trim() || undefined,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || undefined,
  clinicSlug: import.meta.env.VITE_CLINIC_SLUG?.trim() || undefined,
};

/**
 * معرّف العيادة الحالي (يُقرأ حصرياً من VITE_CLINIC_SLUG دون أي قيمة افتراضية مكتوبة صراحة)
 */
export const clinicSlug: string = supabaseConfig.clinicSlug || '';
export const clinicId: string = clinicSlug;

export const supabaseConfigured = Boolean(
  supabaseConfig.url && supabaseConfig.anonKey && supabaseConfig.clinicSlug
);

export const supabaseConfigError: string | null = supabaseConfigured
  ? null
  : !supabaseConfig.clinicSlug
  ? 'خطأ في الإعدادات: لم يتم ضبط معرّف العيادة (VITE_CLINIC_SLUG) في متغيرات البيئة. يرجى ضبط VITE_CLINIC_SLUG قبل المتابعة.'
  : 'تنبيه: متغيرات الاتصال بـ Supabase ناقصة (VITE_SUPABASE_URL أو VITE_SUPABASE_ANON_KEY أو VITE_CLINIC_SLUG). يعمل التطبيق حالياً بدون اتصال سحابي بـ Supabase حتى تتم إضافتها في إعدادات البيئة.';

if (!supabaseConfigured && typeof console !== 'undefined') {
  console.warn(`[Soli Medical - Supabase] ${supabaseConfigError}`);
}

let supabaseInstance: SupabaseClient | null = null;

if (supabaseConfigured && supabaseConfig.url && supabaseConfig.anonKey && supabaseConfig.clinicSlug) {
  try {
    supabaseInstance = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  } catch (err) {
    console.warn(
      '[Soli Medical - Supabase] تعذر تهيئة عميل Supabase، سيتم المتابعة في الوضع المحلي لمنع انهيار التطبيق:',
      err
    );
    supabaseInstance = null;
  }
}

/**
 * العميل الموحد لـ Supabase عبر التطبيق
 */
export const supabase: SupabaseClient | null = supabaseInstance;

export function requireClinicSlug(): string {
  if (!clinicSlug) {
    throw new Error(
      'خطأ في الإعدادات: لم يتم ضبط معرّف العيادة (VITE_CLINIC_SLUG) في متغيرات البيئة. يرجى ضبط VITE_CLINIC_SLUG قبل المتابعة.'
    );
  }
  return clinicSlug;
}

export function requireSupabase(): SupabaseClient {
  requireClinicSlug();
  if (!supabase) {
    throw new Error(
      supabaseConfigError ?? 'أضف إعدادات Supabase (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_CLINIC_SLUG) قبل المتابعة.'
    );
  }
  return supabase;
}
