import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

interface ResetPasswordRequest {
  uid: string;
  tempPassword?: string;
  clinicId?: string;
}

function generateOneTimeTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

const MAX_BODY_BYTES = 64 * 1024;

async function parseBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'object') return req.body;
    if (typeof req.body === 'string') {
      if (Buffer.byteLength(req.body, 'utf8') > MAX_BODY_BYTES) {
        throw new Error('PAYLOAD_TOO_LARGE');
      }
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendResponse(res, 405, { error: 'الطريقة غير مسموح بها. استخدم POST.' });
  }

  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return sendResponse(res, 401, { error: 'غير مصرح: يجب تسجيل الدخول كمدير.' });
    }
    const accessToken = authHeader.slice(7).trim();

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    const defaultClinicId =
      (process.env.VITE_CLINIC_SLUG || process.env.CLINIC_SLUG || '').trim() || 'solimedical-new2';

    if (!supabaseUrl || !serviceRoleKey) {
      return sendResponse(res, 500, {
        error: 'متغيرات بيئة Supabase غير مكتملة على الخادم (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).',
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    // 1. Verify caller session
    const { data: callerAuth, error: callerErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (callerErr || !callerAuth?.user) {
      return sendResponse(res, 401, { error: 'انتهت صلاحية جلسة المدير. يرجى إعادة تسجيل الدخول.' });
    }
    const callerUid = callerAuth.user.id;

    // 2. Parse request body
    const body = (await parseBody(req)) as ResetPasswordRequest;
    const targetUid = (body.uid || '').trim();
    const targetClinicId = (body.clinicId || defaultClinicId).trim();

    if (!targetUid) {
      return sendResponse(res, 400, { error: 'معرّف المستخدم (uid) مطلوب.' });
    }

    const finalTempPassword =
      body.tempPassword && body.tempPassword.trim().length > 0
        ? body.tempPassword.trim()
        : generateOneTimeTempPassword();

    if (finalTempPassword.length < 8) {
      return sendResponse(res, 400, { error: 'كلمة المرور المؤقتة يجب ألا تقل عن 8 خانات.' });
    }

    // 3. Verify caller is an active member with user management permission in clinic_members
    const { data: callerMember, error: callerMemberErr } = await supabaseAdmin
      .from('clinic_members')
      .select('role, is_active, permissions')
      .eq('clinic_id', targetClinicId)
      .eq('user_id', callerUid)
      .maybeSingle();

    const callerPerms = (callerMember?.permissions || {}) as Record<string, any>;
    const callerSpecial = callerPerms.specialPermissions as Record<string, boolean> | undefined;
    const callerCustom = callerPerms.customPermissions as Record<string, Record<string, boolean>> | undefined;
    const isCallerAdminRole = String(callerMember?.role || '').toLowerCase() === 'admin';
    const hasExplicitManage =
      typeof callerSpecial?.['users.manage'] === 'boolean'
        ? callerSpecial['users.manage']
        : typeof callerCustom?.['system-settings']?.update === 'boolean'
        ? callerCustom['system-settings'].update
        : isCallerAdminRole;

    if (callerMemberErr || !callerMember || callerMember.is_active === false || !hasExplicitManage) {
      return sendResponse(res, 403, {
        error: 'غير مصرح: إعادة تعيين كلمة المرور متاحة لمن يملك صلاحية إدارة المستخدمين (users.manage) فقط.',
      });
    }

    // 4. Verify target user belongs to the same clinic
    const { data: targetMember, error: targetMemberErr } = await supabaseAdmin
      .from('clinic_members')
      .select('user_id')
      .eq('clinic_id', targetClinicId)
      .eq('user_id', targetUid)
      .maybeSingle();

    if (targetMemberErr || !targetMember) {
      return sendResponse(res, 404, {
        error: 'المستخدم المطلوب غير مسجل ضمن أعضاء هذه العيادة.',
      });
    }

    // 5. Reset password via Supabase Admin API without sending any email
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUid, {
      password: finalTempPassword,
      email_confirm: true,
    });

    if (updateErr) {
      console.error(JSON.stringify({
        event: 'reset_password_failed',
        targetUid,
        error: updateErr.message,
      }));
      return sendResponse(res, 400, {
        error: 'تعذر تحديث كلمة المرور المؤقتة للمستخدم.',
      });
    }

    // Return temporary password once to the admin
    return sendResponse(res, 200, {
      success: true,
      tempPassword: finalTempPassword,
    });
  } catch (err: any) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      return sendResponse(res, 413, { error: 'حجم الطلب يتجاوز الحد الأقصى المسموح به (64KB).' });
    }
    console.error(JSON.stringify({
      event: 'user_reset_password_error',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }));
    return sendResponse(res, 500, {
      error: 'حدث خطأ في الخادم أثناء إعادة تعيين كلمة المرور.',
    });
  }
}
