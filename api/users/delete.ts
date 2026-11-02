import { createClient } from '@supabase/supabase-js';

interface DeleteUserRequest {
  uid: string;
  username?: string;
  clinicId?: string;
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
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk: any) => {
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
  res.setHeader('Access-Control-Allow-Origin', '*');
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
      .select('role, is_active')
      .eq('clinic_id', targetClinicId)
      .eq('user_id', callerUid)
      .maybeSingle();

    if (
      memberErr ||
      !callerMember ||
      callerMember.is_active === false ||
      String(callerMember.role).toLowerCase() !== 'admin'
    ) {
      return sendResponse(res, 403, {
        error: 'غير مصرح: هذه العملية متاحة لمدير العيادة (Admin) فقط.',
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
        return sendResponse(res, 500, {
          error: deleteAuthErr.message || 'تعذر حذف المستخدم من خدمة المصادقة.',
        });
      }
    }

    return sendResponse(res, 200, { success: true, uid: targetUid });
  } catch (err: any) {
    return sendResponse(res, 500, {
      error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء حذف الحساب.',
    });
  }
}
