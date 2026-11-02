/**
 * SOLI MEDICAL — CRYPTOGRAPHIC ADMIN RECOVERY SERVICE
 * 
 * Secure PBKDF2 (SHA-256 with 100,000 iterations & 16-byte cryptographic salt)
 * for admin password recovery without storing cleartext tokens anywhere.
 */

import { createClient } from '@supabase/supabase-js';
import { supabase, clinicId } from './supabase';

const RECOVERY_DOC_ID = '_system_recovery';

// Helper: Convert ArrayBuffer to Hex String
function buf2hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Convert Hex String to Uint8Array
function hex2buf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Generates a clean 24-character recovery code in standard grouped format:
 * SOLI-XXXX-XXXX-XXXX-XXXX-XXXX
 */
export function generateAdminRecoveryCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const array = new Uint8Array(20);
  window.crypto.getRandomValues(array);
  let token = '';
  for (let i = 0; i < array.length; i++) {
    token += chars[array[i] % chars.length];
  }
  // Format as 5 chunks of 4 characters with SOLI prefix
  const chunks = token.match(/.{1,4}/g) || [];
  return `SOLI-${chunks.join('-')}`;
}

/**
 * Derives a PBKDF2 hash from a recovery code and salt.
 */
async function derivePbkdf2Hash(code: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, '');

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(normalizedCode),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return buf2hex(derivedBits);
}

/**
 * Derives an AES-GCM encryption key from the recovery code for the escrow envelope.
 */
async function deriveAesKey(code: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, '');

  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(normalizedCode),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data using AES-GCM.
 */
async function encryptWithCode(code: string, salt: Uint8Array, plaintext: string): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const key = await deriveAesKey(code, salt);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    enc.encode(plaintext)
  );

  return {
    ciphertext: buf2hex(encrypted),
    iv: buf2hex(iv.buffer),
  };
}

/**
 * Decrypts data using AES-GCM.
 */
async function decryptWithCode(code: string, salt: Uint8Array, ciphertextHex: string, ivHex: string): Promise<string> {
  const dec = new TextDecoder();
  const key = await deriveAesKey(code, salt);
  const iv = hex2buf(ivHex);
  const ciphertext = hex2buf(ciphertextHex);

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    ciphertext
  );

  return dec.decode(decrypted);
}

/**
 * Saves a new Admin Recovery Code into Supabase settings using PBKDF2 hash and an encrypted escrow envelope.
 * Plaintext code is NEVER saved.
 */
export async function setupAdminRecoveryCode(params: {
  recoveryCode: string;
  adminCurrentPassword?: string;
}): Promise<void> {
  if (!supabase) throw new Error('عميل Supabase غير مهيأ.');
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUser = sessionData?.session?.user;
  if (!currentUser) throw new Error('يجب تسجيل الدخول كمدير لحفظ رمز الاسترداد.');

  // Generate 16-byte random cryptographic salt
  const salt = new Uint8Array(16);
  window.crypto.getRandomValues(salt);
  const saltHex = buf2hex(salt.buffer);

  // Compute PBKDF2 hash (100,000 iterations)
  const hashHex = await derivePbkdf2Hash(params.recoveryCode, salt);

  // Encrypt admin verification payload (stored securely in envelope)
  const adminEmail = currentUser.email || 'admin@auth.solimedical.local';
  const payloadToEscrow = JSON.stringify({
    uid: currentUser.id,
    email: adminEmail,
    adminPass: params.adminCurrentPassword || 'admin1234',
    created: Date.now(),
  });

  const { ciphertext, iv } = await encryptWithCode(params.recoveryCode, salt, payloadToEscrow);
  const nowIso = new Date().toISOString();

  const { error } = await supabase.from('settings').upsert(
    {
      clinic_id: clinicId,
      id: RECOVERY_DOC_ID,
      data: {
        version: 2,
        salt: saltHex,
        hash: hashHex,
        envelope: ciphertext,
        iv: iv,
        targetEmail: adminEmail,
        attempts: 0,
        lockedUntil: null,
        updatedAt: nowIso,
      },
      updated_at: nowIso,
    },
    { onConflict: 'clinic_id,id' }
  );

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Checks if an admin recovery code has been configured in the system.
 */
export async function hasAdminRecoveryConfigured(): Promise<boolean> {
  try {
    if (!supabase) return false;
    const { data: row } = await supabase
      .from('settings')
      .select('data')
      .eq('clinic_id', clinicId)
      .eq('id', RECOVERY_DOC_ID)
      .maybeSingle();
    const rec = row?.data as Record<string, any> | undefined;
    return Boolean(rec?.hash);
  } catch {
    return false;
  }
}

/**
 * Recovers the admin account using the recovery code and sets a new password.
 * Rate-limited: max 5 failed attempts before temporary lockout.
 */
export async function recoverAdminPasswordWithCode(params: {
  username: string;
  recoveryCode: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  if (!supabase) throw new Error('عميل Supabase غير مهيأ.');
  const normalizedUsername = params.username.trim().toLowerCase();

  if (normalizedUsername !== 'admin') {
    throw new Error('رمز الاسترداد مخصص لحساب مدير النظام (admin) فقط.');
  }

  if (params.newPassword.length < 8) {
    throw new Error('كلمة المرور الجديدة يجب ألا تقل عن 8 خانات.');
  }

  const { data: recoveryRow } = await supabase
    .from('settings')
    .select('data')
    .eq('clinic_id', clinicId)
    .eq('id', RECOVERY_DOC_ID)
    .maybeSingle();

  const data = (recoveryRow?.data || {}) as Record<string, any>;
  if (!data?.hash) {
    throw new Error('لم يتم تعيين رمز استرداد للمدير في هذا النظام من قبل.');
  }

  // Rate Limiting / Lockout Check
  const now = Date.now();
  if (data.lockedUntil && Number(data.lockedUntil) > now) {
    const remainingMinutes = Math.ceil((Number(data.lockedUntil) - now) / 60000);
    throw new Error(`تم إيقاف محاولات الاسترداد مؤقتاً بسبب المحاولات الخاطئة المتكررة. حاول مجدداً بعد ${remainingMinutes} دقيقة.`);
  }

  const salt = hex2buf(data.salt);
  const calculatedHash = await derivePbkdf2Hash(params.recoveryCode, salt);

  if (calculatedHash !== data.hash) {
    const currentAttempts = (data.attempts || 0) + 1;
    const isLocked = currentAttempts >= 5;
    await supabase.from('settings').upsert(
      {
        clinic_id: clinicId,
        id: RECOVERY_DOC_ID,
        data: {
          ...data,
          attempts: currentAttempts,
          lockedUntil: isLocked ? now + 15 * 60 * 1000 : null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'clinic_id,id' }
    );

    if (isLocked) {
      throw new Error('رمز الاسترداد غير صحيح. تم إيقاف المحاولات لمدة 15 دقيقة لدواعي الأمان.');
    } else {
      throw new Error(`رمز الاسترداد غير صحيح. المتبقي لك ${5 - currentAttempts} محاولات قبل الإغلاق.`);
    }
  }

  // Decrypt the escrow envelope to get admin session
  let decryptedPayload: { uid?: string; email?: string; adminPass?: string } = {};
  if (data.envelope && data.iv) {
    try {
      const plaintext = await decryptWithCode(params.recoveryCode, salt, data.envelope, data.iv);
      decryptedPayload = JSON.parse(plaintext);
    } catch {
      console.warn('[Recovery] Envelope decryption skipped.');
    }
  }

  const adminEmail = data.targetEmail || decryptedPayload.email || 'admin@auth.solimedical.local';
  const knownPass = decryptedPayload.adminPass || 'admin1234';

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
  const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('إعدادات Supabase غير مكتملة.');
  }

  const secondaryClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    let signInRes = await secondaryClient.auth.signInWithPassword({
      email: adminEmail,
      password: knownPass,
    });

    if (signInRes.error) {
      signInRes = await secondaryClient.auth.signInWithPassword({
        email: adminEmail,
        password: 'admin1234',
      });
    }

    if (signInRes.error || !signInRes.data.user) {
      throw new Error(signInRes.error?.message || 'تعذر التحقق من جلسة المدير لاسترداد كلمة المرور.');
    }

    const { error: updateErr } = await secondaryClient.auth.updateUser({
      password: params.newPassword,
    });
    if (updateErr) {
      throw new Error(updateErr.message);
    }

    const updatedPayload = JSON.stringify({
      uid: signInRes.data.user.id,
      email: adminEmail,
      adminPass: params.newPassword,
      recoveredAt: Date.now(),
    });
    const { ciphertext, iv } = await encryptWithCode(params.recoveryCode, salt, updatedPayload);
    const nowIso = new Date().toISOString();

    await supabase.from('settings').upsert(
      {
        clinic_id: clinicId,
        id: RECOVERY_DOC_ID,
        data: {
          ...data,
          envelope: ciphertext,
          iv: iv,
          attempts: 0,
          lockedUntil: null,
          lastRecoveredAt: nowIso,
        },
        updated_at: nowIso,
      },
      { onConflict: 'clinic_id,id' }
    );

    return {
      success: true,
      message: 'تم استرداد حساب المدير وتحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
    };
  } finally {
    await secondaryClient.auth.signOut().catch(() => undefined);
  }
}

