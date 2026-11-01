/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_CLINIC_SLUG?: string;
  readonly VITE_INTERNAL_EMAIL_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
