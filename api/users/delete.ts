import { createClient } from '@supabase/supabase-js';

interface DeleteUserRequest {
  uid: string;
  username?: string;
  clinicId?: string;
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

    const { data: callerAuth, error: callerErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (callerErr || !callerAuth?.user) {
      return sendResponse(res, 401, { error: 'انتهت صلاحية جلسة المدير. يرجى إعادة تسجيل الدخول.' });
    }
    const callerUid = callerAuth.user.id;

    const body = (await parseBody(req)) as DeleteUserRequest;
    const targetClinicId = (body.clinicId || defaultClinicId).trim();
    const targetUid = (body.uid || '').trim();
    const usernameLower = (body.username || '').trim().toLowerCase();

    if (!targetUid) {
      return sendResponse(res, 400, { error: 'معرّف المستخدم (uid) مطلوب.' });
    }
    if (targetUid === callerUid) {
      return sendResponse(res, 400, { error: 'لا يمكنك حذف حسابك الحالي المسجل به.' });
    }

    const { data: callerMember, error: memberErr } = await supabaseAdmin
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
        : typeof callerCustom?.['system-settings']?.delete === 'boolean'
        ? callerCustom['system-settings'].delete
        : isCallerAdminRole;

    if (memberErr || !callerMember || callerMember.is_active === false || !hasExplicitManage) {
      return sendResponse(res, 403, {
        error: 'غير مصرح: هذه العملية متاحة لمن يملك صلاحية إدارة المستخدمين (users.manage) فقط.',
      });
    }

    // Verify target user is actually a member of this clinic
    const { data: targetMember, error: targetMemberErr } = await supabaseAdmin
      .from('clinic_members')
      .select('user_id')
      .eq('clinic_id', targetClinicId)
      .eq('user_id', targetUid)
      .maybeSingle();

    if (targetMemberErr || !targetMember) {
      return sendResponse(res, 404, {
        error: 'المستخدم غير مسجل ضمن أعضاء هذه العيادة.',
      });
    }

    await supabaseAdmin
      .from('clinic_members')
      .delete()
      .eq('clinic_id', targetClinicId)
      .eq('user_id', targetUid);

    const { data: remainingMemberships } = await supabaseAdmin
      .from('clinic_members')
      .select('clinic_id')
      .eq('user_id', targetUid)
      .limit(1);

    if (!remainingMemberships || remainingMemberships.length === 0) {
      await supabaseAdmin.from('usernames').delete().eq('user_id', targetUid);
      if (usernameLower) {
        await supabaseAdmin.from('usernames').delete().eq('username_lower', usernameLower);
      }

      const { error: deleteAuthErr } = await supabaseAdmin.auth.admin.deleteUser(targetUid);
      if (deleteAuthErr) {
        console.error(JSON.stringify({
          event: 'delete_auth_user_failed',
          targetUid,
          error: deleteAuthErr.message,
        }));
        return sendResponse(res, 500, {
          error: 'تعذر حذف المستخدم من خدمة المصادقة. يرجى مراجعة سجلات الخادم.',
        });
      }
    }

    return sendResponse(res, 200, { success: true, uid: targetUid });
  } catch (err: any) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      return sendResponse(res, 413, { error: 'حجم الطلب يتجاوز الحد الأقصى المسموح به (64KB).' });
    }
    console.error(JSON.stringify({
      event: 'user_delete_failed',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }));
    return sendResponse(res, 500, {
      error: 'حدث خطأ غير متوقع في الخادم أثناء حذف الحساب.',
    });
  }
}
