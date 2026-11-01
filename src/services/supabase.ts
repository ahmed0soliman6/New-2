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
 * معرّف العيادة الحالي (يُقرأ من VITE_CLINIC_SLUG مع قيمة افتراضية آمنة لعدم انهيار التطبيق)
 */
export const clinicSlug: string = supabaseConfig.clinicSlug || 'solimedical-new2';
export const clinicId: string = clinicSlug;

export const supabaseConfigured = Boolean(
  supabaseConfig.url && supabaseConfig.anonKey
);

export const supabaseConfigError: string | null = supabaseConfigured
  ? null
  : 'تنبيه: متغيرات الاتصال بـ Supabase ناقصة (VITE_SUPABASE_URL أو VITE_SUPABASE_ANON_KEY). يعمل التطبيق حالياً بدون اتصال سحابي بـ Supabase حتى تتم إضافتها في إعدادات البيئة.';

if (!supabaseConfigured && typeof console !== 'undefined') {
  console.warn(`[Soli Medical - Supabase] ${supabaseConfigError}`);
}

let supabaseInstance: SupabaseClient | null = null;

if (supabaseConfigured && supabaseConfig.url && supabaseConfig.anonKey) {
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

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      supabaseConfigError ?? 'أضف إعدادات Supabase في متغيرات VITE_SUPABASE_* قبل المتابعة.'
    );
  }
  return supabase;
}
