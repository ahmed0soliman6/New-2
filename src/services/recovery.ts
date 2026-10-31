/**
 * SOLI MEDICAL — CRYPTOGRAPHIC ADMIN RECOVERY SERVICE
 * 
 * Secure PBKDF2 (SHA-256 with 100,000 iterations & 16-byte cryptographic salt)
 * for admin password recovery without storing cleartext tokens anywhere.
 */

import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, updatePassword, signOut } from 'firebase/auth';
import { requireFirebase, firebaseConfig } from './firebase';

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
 * Saves a new Admin Recovery Code into Firestore using PBKDF2 hash and an encrypted escrow envelope.
 * Plaintext code is NEVER saved.
 */
export async function setupAdminRecoveryCode(params: {
  recoveryCode: string;
  adminCurrentPassword?: string;
}): Promise<void> {
  const { db, auth } = requireFirebase();
  const currentUser = auth.currentUser;
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
    uid: currentUser.uid,
    email: adminEmail,
    adminPass: params.adminCurrentPassword || 'admin1234',
    created: Date.now(),
  });

  const { ciphertext, iv } = await encryptWithCode(params.recoveryCode, salt, payloadToEscrow);

  await setDoc(
    doc(db, '_system', 'recovery'),
    {
      version: 2,
      salt: saltHex,
      hash: hashHex,
      envelope: ciphertext,
      iv: iv,
      targetEmail: adminEmail,
      attempts: 0,
      lockedUntil: null,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

/**
 * Checks if an admin recovery code has been configured in the system.
 */
export async function hasAdminRecoveryConfigured(): Promise<boolean> {
  try {
    const { db } = requireFirebase();
    const snap = await getDoc(doc(db, '_system', 'recovery'));
    return snap.exists() && Boolean(snap.data()?.hash);
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
  const { db } = requireFirebase();
  const normalizedUsername = params.username.trim().toLowerCase();

  if (normalizedUsername !== 'admin') {
    throw new Error('رمز الاسترداد مخصص لحساب مدير النظام (admin) فقط.');
  }

  if (params.newPassword.length < 8) {
    throw new Error('كلمة المرور الجديدة يجب ألا تقل عن 8 خانات.');
  }

  const recoveryDocRef = doc(db, '_system', 'recovery');
  const recoverySnap = await getDoc(recoveryDocRef);

  if (!recoverySnap.exists() || !recoverySnap.data()?.hash) {
    throw new Error('لم يتم تعيين رمز استرداد للمدير في هذا النظام من قبل.');
  }

  const data = recoverySnap.data();

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
    await setDoc(
      recoveryDocRef,
      {
        attempts: currentAttempts,
        lockedUntil: isLocked ? now + 15 * 60 * 1000 : null, // 15 min lockout
      },
      { merge: true }
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

  // Perform password update using a secondary isolated Firebase App
  const secondary = initializeApp(firebaseConfig, `recovery-${Date.now()}`);
  const secondaryAuth = getAuth(secondary);

  try {
    let credential;
    try {
      credential = await signInWithEmailAndPassword(secondaryAuth, adminEmail, knownPass);
    } catch {
      // Fallback try common initial pass or direct credential
      credential = await signInWithEmailAndPassword(secondaryAuth, adminEmail, 'admin1234');
    }

    await updatePassword(credential.user, params.newPassword);

    // Update escrow envelope with the new password so future recoveries remain seamless
    const updatedPayload = JSON.stringify({
      uid: credential.user.uid,
      email: adminEmail,
      adminPass: params.newPassword,
      recoveredAt: Date.now(),
    });
    const { ciphertext, iv } = await encryptWithCode(params.recoveryCode, salt, updatedPayload);

    await setDoc(
      recoveryDocRef,
      {
        envelope: ciphertext,
        iv: iv,
        attempts: 0,
        lockedUntil: null,
        lastRecoveredAt: serverTimestamp(),
      },
      { merge: true }
    );

    return {
      success: true,
      message: 'تم استرداد حساب المدير وتحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
    };
  } finally {
    await signOut(secondaryAuth).catch(() => undefined);
    await deleteApp(secondary);
  }
}
