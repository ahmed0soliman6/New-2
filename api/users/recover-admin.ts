import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

interface RecoverAdminRequest {
  username?: string;
  recoveryCode: string;
  newPassword: string;
  clinicId?: string;
}

const MAX_BODY_BYTES = 16 * 1024;
const RECOVERY_DOC_ID = '_system_recovery';

// In-memory brute force protection per IP/clinic
const rateLimitMap = new Map<string, { count: number; lockedUntil: number }>();

function checkRateLimit(key: string): { allowed: boolean; remainingMinutes?: number; remainingAttempts?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (entry) {
    if (entry.lockedUntil > now) {
      return { allowed: false, remainingMinutes: Math.ceil((entry.lockedUntil - now) / 60000) };
    }
    if (entry.lockedUntil <= now && entry.count >= 5) {
      rateLimitMap.delete(key);
    }
  }

  const currentCount = (rateLimitMap.get(key)?.count || 0) + 1;
  const isLocked = currentCount >= 5;
  rateLimitMap.set(key, {
    count: currentCount,
    lockedUntil: isLocked ? now + 15 * 60 * 1000 : 0,
  });

  if (isLocked) {
    return { allowed: false, remainingMinutes: 15 };
  }
  return { allowed: true, remainingAttempts: 5 - currentCount };
}

function resetRateLimit(key: string) {
  rateLimitMap.delete(key);
}

function derivePbkdf2HashNode(code: string, saltHex: string): string {
  const normalizedCode = code.trim().toUpperCase().replace(/\s+/g, '');
  const salt = Buffer.from(saltHex, 'hex');
  const derived = crypto.pbkdf2Sync(normalizedCode, salt, 100000, 32, 'sha256');
  return derived.toString('hex');
}

async function parseBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
  }
  return new Promise((resolve, reject) => {
    let data = '';
    let receivedBytes = 0;
    req.on('data', (chunk: any) => {
      const chunkLen = typeof chunk === 'string' ? Buffer.byteLength(chunk, 'utf8') : (chunk?.length || 0);
      receivedBytes += chunkLen;
      if (receivedBytes > MAX_BODY_BYTES) {
        if (typeof req.destroy === 'function') req.destroy();
        reject(new Error('PAYLOAD_TOO_LARGE'));
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

function sendResponse(res: any, status: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

export default async function handler(req: any, res: any) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendResponse(res, 405, { error: 'الطريقة غير مسموح بها. استخدم POST.' });
  }

  try {
    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const defaultClinicId =
      (process.env.VITE_CLINIC_SLUG || process.env.CLINIC_SLUG || '').trim() || 'solimedical-new2';

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[RecoverAdmin] Server configuration error: Missing Supabase service credentials.');
      return sendResponse(res, 500, {
        error: 'إعدادات الخادم غير مكتملة. يرجى التواصل مع الدعم الفني.',
      });
    }

    const body = (await parseBody(req)) as RecoverAdminRequest;
    const clinicId = (body.clinicId || defaultClinicId).trim();
    const recoveryCode = (body.recoveryCode || '').trim();
    const newPassword = body.newPassword || '';
    const username = (body.username || 'admin').trim().toLowerCase();

    if (!recoveryCode) {
      return sendResponse(res, 400, { error: 'رمز الاسترداد مطلوب.' });
    }
    if (newPassword.length < 8) {
      return sendResponse(res, 400, { error: 'كلمة المرور الجديدة يجب ألا تقل عن 8 خانات.' });
    }

    // Rate Limiting check based on client IP & clinic
    const clientIp = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const rateLimitKey = `recover_${clinicId}_${clientIp}`;
    const rateCheck = checkRateLimit(rateLimitKey);

    if (!rateCheck.allowed) {
      return sendResponse(res, 429, {
        error: `تم إيقاف محاولات الاسترداد مؤقتاً بسبب تكرار المحاولات الخاطئة. يرجى الانتظار ${rateCheck.remainingMinutes} دقيقة.`,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // 1. Fetch recovery settings doc for this clinic
    const { data: recoveryRow, error: recoveryErr } = await supabaseAdmin
      .from('settings')
      .select('data')
      .eq('clinic_id', clinicId)
      .eq('id', RECOVERY_DOC_ID)
      .maybeSingle();

    if (recoveryErr || !recoveryRow?.data) {
      console.error('[RecoverAdmin] Recovery row fetch error:', recoveryErr?.message);
      return sendResponse(res, 404, {
        error: 'لم يتم إعداد رمز استرداد للنظام بعد. يرجى تسجيل الدخول وإعداده من شاشة الإعدادات.',
      });
    }

    const recData = recoveryRow.data as Record<string, any>;
    if (!recData.hash || !recData.salt) {
      return sendResponse(res, 400, {
        error: 'بيانات رمز الاسترداد المسجلة غير صالحة.',
      });
    }

    // 2. Validate PBKDF2 hash
    const computedHash = derivePbkdf2HashNode(recoveryCode, recData.salt);
    if (computedHash !== recData.hash) {
      return sendResponse(res, 401, {
        error: `رمز الاسترداد غير صحيح. المتبقي لك ${rateCheck.remainingAttempts} محاولات قبل الإغلاق المؤقت.`,
      });
    }

    // 3. Reset rate limit on success
    resetRateLimit(rateLimitKey);

    // 4. Resolve admin user ID
    let targetAdminUserId: string | null = null;
    let targetEmail: string | null = recData.targetEmail || null;

    // Check usernames table
    const { data: usernameEntry } = await supabaseAdmin
      .from('usernames')
      .select('user_id')
      .eq('username_lower', username)
      .maybeSingle();

    if (usernameEntry?.user_id) {
      targetAdminUserId = usernameEntry.user_id;
    } else {
      // Find admin member in clinic_members
      const { data: adminMember } = await supabaseAdmin
        .from('clinic_members')
        .select('user_id')
        .eq('clinic_id', clinicId)
        .eq('role', 'admin')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (adminMember?.user_id) {
        targetAdminUserId = adminMember.user_id;
      }
    }

    if (!targetAdminUserId) {
      return sendResponse(res, 404, {
        error: 'تعذر العثور على حساب مدير مسجل في هذه العيادة.',
      });
    }

    // 5. Update password securely via Supabase Admin API
    const { data: updatedUser, error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      targetAdminUserId,
      { password: newPassword }
    );

    if (updateErr) {
      console.error('[RecoverAdmin] UpdateUserById failed:', updateErr.message);
      return sendResponse(res, 500, {
        error: 'حدث خطأ أثناء تحديث كلمة مرور المدير على الخادم.',
      });
    }

    // 6. Update recovery metadata (without storing passwords or envelopes)
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from('settings').upsert(
      {
        clinic_id: clinicId,
        id: RECOVERY_DOC_ID,
        data: {
          version: 3,
          salt: recData.salt,
          hash: recData.hash,
          targetEmail: updatedUser.user?.email || targetEmail,
          attempts: 0,
          lockedUntil: null,
          lastRecoveredAt: nowIso,
        },
        updated_at: nowIso,
      },
      { onConflict: 'clinic_id,id' }
    );

    return sendResponse(res, 200, {
      success: true,
      message: 'تم استرداد حساب المدير وتعيين كلمة المرور الجديدة بنجاح! يمكنك الآن تسجيل الدخول.',
    });
  } catch (err: any) {
    console.error('[RecoverAdmin] Unexpected failure:', err?.message || err);
    return sendResponse(res, 500, {
      error: 'حدث خطأ غير متوقع أثناء معالجة الطلب.',
    });
  }
}
