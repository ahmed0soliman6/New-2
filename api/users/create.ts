import { createClient } from '@supabase/supabase-js';

interface CreateUserRequest {
  username: string;
  displayName: string;
  password: string;
  role: string;
  allowedScreens?: string[];
  customPermissions?: Record<string, unknown>;
  clinicId?: string;
}

const MAX_BODY_BYTES = 64 * 1024;
const ALLOWED_ROLES = new Set(['admin', 'doctor', 'secretary']);

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
    const internalDomain =
      (process.env.VITE_INTERNAL_EMAIL_DOMAIN || process.env.INTERNAL_EMAIL_DOMAIN || '').trim() ||
      'auth.solimedical.local';
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

    // 1. Verify caller identity via JWT token
    const { data: callerAuth, error: callerErr } = await supabaseAdmin.auth.getUser(accessToken);
    if (callerErr || !callerAuth?.user) {
      return sendResponse(res, 401, { error: 'انتهت صلاحية جلسة المدير. يرجى إعادة تسجيل الدخول.' });
    }
    const callerUid = callerAuth.user.id;

    // 2. Parse request body
    const body = (await parseBody(req)) as CreateUserRequest;
    const targetClinicId = (body.clinicId || defaultClinicId).trim();
    const usernameLower = (body.username || '').trim().toLowerCase();
    const displayName = (body.displayName || '').trim();
    const password = body.password || '';
    const roleRaw = (body.role || 'SECRETARY').trim();

    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(usernameLower)) {
      return sendResponse(res, 400, { error: 'اسم المستخدم غير صحيح.' });
    }
    if (!displayName) {
      return sendResponse(res, 400, { error: 'الاسم الظاهر مطلوب.' });
    }
    if (password.length < 8) {
      return sendResponse(res, 400, { error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' });
    }

    // 3. Verify caller is an active member with user management permission in clinic_members
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
        : typeof callerCustom?.['system-settings']?.create === 'boolean'
        ? callerCustom['system-settings'].create
        : isCallerAdminRole;

    if (memberErr || !callerMember || callerMember.is_active === false || !hasExplicitManage) {
      return sendResponse(res, 403, {
        error: 'غير مصرح: هذه العملية متاحة لمن يملك صلاحية إدارة المستخدمين (users.manage) فقط.',
      });
    }

    // 4. Check if username is already taken
    const { data: existingUsername } = await supabaseAdmin
      .from('usernames')
      .select('user_id')
      .eq('username_lower', usernameLower)
      .maybeSingle();

    if (existingUsername) {
      return sendResponse(res, 409, { error: 'اسم المستخدم مسجل بالفعل.' });
    }

    const internalEmail = `${usernameLower}@${internalDomain}`;
    const normalizedRole = roleRaw.toLowerCase();

    if (!ALLOWED_ROLES.has(normalizedRole)) {
      return sendResponse(res, 400, {
        error: 'نوع الصلاحية (Role) غير صالح. القيم المسموحة: admin, doctor, secretary.',
      });
    }

    // 5. Create user in Supabase Auth with email_confirm: true (no email sent)
    const { data: createdAuth, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username: usernameLower,
        displayName,
        role: normalizedRole.toUpperCase(),
        clinicId: targetClinicId,
      },
    });

    if (createErr || !createdAuth?.user) {
      return sendResponse(res, 400, {
        error: createErr?.message || 'تعذر إنشاء الحساب في خدمة المصادقة.',
      });
    }

    const newUserId = createdAuth.user.id;

    // 6. Store username -> user_id mapping
    const { error: unameInsertErr } = await supabaseAdmin.from('usernames').upsert(
      {
        username_lower: usernameLower,
        user_id: newUserId,
      },
      { onConflict: 'username_lower' }
    );

    if (unameInsertErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return sendResponse(res, 500, { error: 'تعذر حفظ اسم المستخدم في قاعدة البيانات.' });
    }

    // 7. Store clinic membership & permissions JSONB
    const permissionsPayload = {
      username: usernameLower,
      displayName,
      email: internalEmail,
      allowedScreens: body.allowedScreens ?? null,
      customPermissions: body.customPermissions ?? null,
      specialPermissions: (body as any).specialPermissions ?? null,
      createdBy: callerUid,
      updatedAt: new Date().toISOString(),
    };

    const { error: memberInsertErr } = await supabaseAdmin.from('clinic_members').upsert(
      {
        clinic_id: targetClinicId,
        user_id: newUserId,
        role: normalizedRole,
        is_active: true,
        permissions: permissionsPayload,
      },
      { onConflict: 'clinic_id,user_id' }
    );

    if (memberInsertErr) {
      await supabaseAdmin.from('usernames').delete().eq('username_lower', usernameLower);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      return sendResponse(res, 500, { error: 'تعذر ربط المستخدم بالعيادة في clinic_members.' });
    }

    return sendResponse(res, 200, {
      success: true,
      uid: newUserId,
      username: usernameLower,
    });
  } catch (err: any) {
    if (err instanceof Error && err.message === 'PAYLOAD_TOO_LARGE') {
      return sendResponse(res, 413, { error: 'حجم الطلب يتجاوز الحد الأقصى المسموح به (64KB).' });
    }
    console.error(JSON.stringify({
      event: 'user_create_failed',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }));
    return sendResponse(res, 500, {
      error: 'حدث خطأ غير متوقع في الخادم أثناء إنشاء الحساب. تم تسجيل تفاصيل الخطأ.',
    });
  }
}
