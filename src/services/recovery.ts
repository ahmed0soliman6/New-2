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
 * Saves a new Admin Recovery Code into Supabase settings using PBKDF2 hash.
 * Plaintext code and passwords are NEVER saved.
 */
export async function setupAdminRecoveryCode(params: {
  recoveryCode: string;
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
  const adminEmail = currentUser.email || 'admin@auth.solimedical.local';
  const nowIso = new Date().toISOString();

  const { error } = await supabase.from('settings').upsert(
    {
      clinic_id: clinicId,
      id: RECOVERY_DOC_ID,
      data: {
        version: 3,
        salt: saltHex,
        hash: hashHex,
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
 * Delegated to the secure serverless endpoint /api/users/recover-admin with server-side rate-limiting.
 */
export async function recoverAdminPasswordWithCode(params: {
  username: string;
  recoveryCode: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const normalizedUsername = params.username.trim().toLowerCase();
  if (normalizedUsername !== 'admin') {
    throw new Error('رمز الاسترداد مخصص لحساب مدير النظام (admin) فقط.');
  }

  if (!params.recoveryCode?.trim()) {
    throw new Error('رمز الاسترداد مطلوب.');
  }

  if (params.newPassword.length < 8) {
    throw new Error('كلمة المرور الجديدة يجب ألا تقل عن 8 خانات.');
  }

  const response = await fetch('/api/users/recover-admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: normalizedUsername,
      recoveryCode: params.recoveryCode.trim(),
      newPassword: params.newPassword,
      clinicId,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.error || 'تعذر إتمام عملية استرداد كلمة المرور.');
  }

  return {
    success: true,
    message: result.message || 'تم تحديث كلمة مرور المدير بنجاح! يمكنك الآن تسجيل الدخول.',
  };
}


