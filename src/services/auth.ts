import type { User as SupabaseUser } from '@supabase/supabase-js';
import { requireSupabase, clinicId } from './supabase';
import type { UserRole } from '../types/database';
import type { CustomPermissionsMap, SpecialPermissionsMap } from '../permissions';
import { recordAuditLog } from './auditLog';

export type AuthUser = SupabaseUser & {
  uid: string;
  displayName?: string | null;
};

const INTERNAL_EMAIL_DOMAIN =
  ((import.meta.env as Record<string, string | undefined>).VITE_INTERNAL_EMAIL_DOMAIN || '').trim() ||
  'auth.solimedical.local';

const normalizeUsername = (username: string) => username.trim().toLowerCase();
const internalEmail = (username: string) => `${normalizeUsername(username)}@${INTERNAL_EMAIL_DOMAIN}`;

function toAuthUser(user: SupabaseUser): AuthUser {
  const meta = (user.user_metadata || {}) as Record<string, unknown>;
  return Object.assign(user, {
    uid: user.id,
    displayName: typeof meta.displayName === 'string' ? meta.displayName : null,
  });
}

function toUpperUserRole(role?: string | null): UserRole {
  const r = String(role || '').toUpperCase();
  if (r === 'ADMIN') return 'ADMIN';
  if (r === 'DOCTOR') return 'DOCTOR';
  return 'SECRETARY';
}

/**
 * Signs in a user using their username and password via Supabase Auth.
 * Uses the deterministic internal email `${username_lower}@${INTERNAL_EMAIL_DOMAIN}`.
 * Self-registration from the browser is strictly disabled.
 */
export async function loginWithUsername(username: string, password: string): Promise<AuthUser> {
  const supabase = requireSupabase();
  const unameLower = normalizeUsername(username);
  if (!unameLower || !password) {
    throw new Error('يرجى إدخال اسم المستخدم وكلمة المرور.');
  }

  const email = internalEmail(unameLower);

  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError || !signInData?.user) {
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة.');
  }

  const user = signInData.user;

  // Verify membership in clinic_members for this clinic
  const { data: member, error: memberError } = await supabase
    .from('clinic_members')
    .select('role, is_active, permissions')
    .eq('clinic_id', clinicId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (memberError || !member) {
    await supabase.auth.signOut();
    throw new Error(
      'هذا الحساب غير مسجل في قاعدة بيانات مستخدمي العيادة. يرجى مراجعة مسؤول النظام (ADMIN).'
    );
  }

  if (member.is_active === false) {
    await supabase.auth.signOut();
    throw new Error('هذا الحساب معطل حالياً من قِبل الإدارة. يرجى مراجعة إدارة العيادة.');
  }

  return toAuthUser(user);
}

export async function getCurrentUserProfile(uid: string): Promise<{
  uid: string;
  username: string;
  displayName: string;
  role: UserRole;
  active: boolean;
} | null> {
  const supabase = requireSupabase();
  const { data: member, error } = await supabase
    .from('clinic_members')
    .select('user_id, role, is_active, permissions')
    .eq('clinic_id', clinicId)
    .eq('user_id', uid)
    .maybeSingle();

  if (error || !member) return null;

  const perms = (member.permissions || {}) as Record<string, any>;
  const username = typeof perms.username === 'string' ? perms.username : '';
  const displayName =
    typeof perms.displayName === 'string' && perms.displayName
      ? perms.displayName
      : username || 'مستخدم';

  return {
    uid: member.user_id,
    username,
    displayName,
    role: toUpperUserRole(member.role),
    active: member.is_active !== false,
  };
}

export async function getInitialAdminStatus(): Promise<{ ready: boolean; claimed: boolean }> {
  const supabase = requireSupabase();
  const { data } = await supabase
    .from('settings')
    .select('data')
    .eq('clinic_id', clinicId)
    .eq('id', 'bootstrap')
    .maybeSingle();

  const status = (data?.data as Record<string, any> | undefined)?.status;
  return {
    ready: status === 'COMPLETED',
    claimed: status === 'CLAIMED',
  };
}

export async function createInitialAdmin(params: {
  username: string;
  displayName: string;
  password: string;
}): Promise<{ username: string }> {
  const usernameLower = normalizeUsername(params.username);
  if (
    !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(usernameLower) ||
    !params.displayName.trim() ||
    params.password.length < 8
  ) {
    throw new Error('بيانات المدير غير صحيحة.');
  }

  await createManagedUser({
    username: usernameLower,
    displayName: params.displayName.trim(),
    password: params.password,
    role: 'ADMIN',
  });

  return { username: usernameLower };
}

export async function logoutAccount(): Promise<void> {
  const supabase = requireSupabase();
  await supabase.auth.signOut();
}

/**
 * Changes the currently logged in user's password in Supabase Auth.
 */
export async function changeUserPassword(params: {
  currentPassword?: string;
  newPassword: string;
}): Promise<void> {
  const supabase = requireSupabase();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user;

  if (userErr || !user) {
    throw new Error('لم يتم العثور على جلسة تسجيل دخول نشطة.');
  }
  if (params.newPassword.length < 8) {
    throw new Error('كلمة المرور الجديدة يجب ألا تقل عن 8 خانات.');
  }

  if (params.currentPassword && user.email) {
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: params.currentPassword,
    });
    if (verifyErr) {
      throw new Error('كلمة المرور الحالية غير صحيحة.');
    }
  }

  const { error: updateErr } = await supabase.auth.updateUser({
    password: params.newPassword,
  });

  if (updateErr) {
    throw new Error(updateErr.message || 'تعذر تحديث كلمة المرور.');
  }
}


/**
 * Creates a managed user strictly via `/api/users/create` (requires server-side SUPABASE_SERVICE_ROLE_KEY on Vercel).
 * Never calls supabase.auth.signUp from the browser or writes directly to `usernames`.
 */
export async function createManagedUser(params: {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  allowedScreens?: string[];
  customPermissions?: CustomPermissionsMap;
  specialPermissions?: SpecialPermissionsMap;
}): Promise<void> {
  const supabase = requireSupabase();
  const username = normalizeUsername(params.username);
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
    throw new Error('اسم المستخدم غير صحيح.');
  }
  if (params.password.length < 8) {
    throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const callerUid = sessionData.session?.user?.id;
  if (!accessToken || !callerUid) {
    throw new Error('انتهت صلاحية جلسة تسجيل الدخول. يرجى تسجيل الدخول مجدداً.');
  }

  let response: Response;
  try {
    response = await fetch('/api/users/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        username,
        displayName: params.displayName.trim(),
        password: params.password,
        role: params.role,
        allowedScreens: params.allowedScreens,
        customPermissions: params.customPermissions,
        specialPermissions: params.specialPermissions,
        clinicId,
      }),
    });
  } catch {
    throw new Error('إنشاء الحسابات يعمل بعد نشر النظام على الخادم');
  }

  const payload = await response.json().catch(() => ({}));
  if (response.ok) {
    return;
  }

  const serverMsg = String(payload.error || payload.message || '');
  const isRouteOrKeyUnavailable =
    response.status === 404 ||
    serverMsg.includes('SUPABASE_SERVICE_ROLE_KEY') ||
    serverMsg.includes('متغيرات بيئة Supabase غير مكتملة');

  if (isRouteOrKeyUnavailable) {
    throw new Error('إنشاء الحسابات يعمل بعد نشر النظام على الخادم');
  }

  throw new Error(serverMsg || 'تعذر إنشاء حساب المستخدم.');
}

export async function updateManagedUser(
  uid: string,
  updates: {
    displayName?: string;
    role?: UserRole;
    active?: boolean;
    allowedScreens?: string[];
    customPermissions?: CustomPermissionsMap;
    specialPermissions?: SpecialPermissionsMap;
  }
): Promise<void> {
  const supabase = requireSupabase();

  const { data: existing, error: fetchErr } = await supabase
    .from('clinic_members')
    .select('role, is_active, permissions')
    .eq('clinic_id', clinicId)
    .eq('user_id', uid)
    .maybeSingle();

  if (fetchErr || !existing) {
    throw new Error('لم يتم العثور على سجل المستخدم في هذه العيادة.');
  }

  const currentPerms =
    existing.permissions && typeof existing.permissions === 'object'
      ? (existing.permissions as Record<string, unknown>)
      : {};

  const nextPermissions: Record<string, unknown> = {
    ...currentPerms,
    updatedAt: new Date().toISOString(),
  };

  if (updates.displayName !== undefined) {
    nextPermissions.displayName = updates.displayName;
  }
  if (updates.allowedScreens !== undefined) {
    nextPermissions.allowedScreens = updates.allowedScreens;
  }
  if (updates.customPermissions !== undefined) {
    nextPermissions.customPermissions = updates.customPermissions;
  }
  if (updates.specialPermissions !== undefined) {
    nextPermissions.specialPermissions = updates.specialPermissions;
  }

  const rowUpdates: Record<string, unknown> = {
    permissions: nextPermissions,
  };

  if (updates.role !== undefined) {
    rowUpdates.role = updates.role.toLowerCase();
  }
  if (updates.active !== undefined) {
    rowUpdates.is_active = updates.active;
  }

  const { error: updateErr } = await supabase
    .from('clinic_members')
    .update(rowUpdates)
    .eq('clinic_id', clinicId)
    .eq('user_id', uid);

  if (updateErr) {
    throw new Error(updateErr.message || 'تعذر تحديث بيانات المستخدم.');
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const actorUid = sessionData.session?.user?.id || 'unknown';
    await recordAuditLog({
      actorUid,
      action: 'user.permissions.update',
      permissionUsed: 'users.manage',
      targetType: 'clinic_member',
      targetId: uid,
      affectedTables: ['clinic_members'],
      status: 'SUCCESS',
      details: { message: `Updated permissions/profile for user ${uid}` },
    });
  } catch {}

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('soli_permissions_updated', { detail: { uid } }));
    window.dispatchEvent(
      new CustomEvent('soli_supabase_mutated', { detail: { tables: ['clinic_members'] } })
    );
  }
}

/**
 * Deletes a managed user from the clinic via `/api/users/delete` on Vercel (using SUPABASE_SERVICE_ROLE_KEY),
 * with fallback to the database RPC `admin_delete_clinic_user(p_clinic_id, p_user_id)`.
 */
export async function deleteManagedUser(uid: string, username?: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUid = sessionData.session?.user?.id;
  const accessToken = sessionData.session?.access_token;

  if (!currentUid || !accessToken) {
    throw new Error('انتهت صلاحية جلسة تسجيل الدخول. يرجى تسجيل الدخول مجدداً.');
  }
  if (currentUid === uid) {
    throw new Error('لا يمكنك حذف الحساب المسجل به حالياً.');
  }

  // 1. Try server-side `/api/users/delete` endpoint (works on Vercel with SUPABASE_SERVICE_ROLE_KEY)
  try {
    const response = await fetch('/api/users/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ uid, username, clinicId }),
    });

    if (response.ok) {
      return;
    }

    const payload = await response.json().catch(() => ({}));
    const serverMsg = String(payload.error || payload.message || '');
    const isRouteOrKeyUnavailable =
      response.status === 404 ||
      serverMsg.includes('SUPABASE_SERVICE_ROLE_KEY') ||
      serverMsg.includes('متغيرات بيئة Supabase غير مكتملة');

    if (!isRouteOrKeyUnavailable && serverMsg) {
      throw new Error(serverMsg);
    }
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err || '');
    if (
      msg &&
      !msg.includes('SUPABASE_SERVICE_ROLE_KEY') &&
      !msg.includes('متغيرات بيئة Supabase غير مكتملة') &&
      !msg.includes('Failed to fetch')
    ) {
      throw err;
    }
  }

  // 2. Fallback to database RPC `admin_delete_clinic_user`
  const { error } = await supabase.rpc('admin_delete_clinic_user', {
    p_clinic_id: clinicId,
    p_user_id: uid,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('Cannot delete your own active account')) {
      throw new Error('لا يمكنك حذف الحساب المسجل به حالياً.');
    }
    if (msg.includes('User is not a member of this clinic')) {
      throw new Error('المستخدم غير مسجل ضمن أعضاء هذه العيادة.');
    }
    if (msg.includes('Unauthorized')) {
      throw new Error('غير مصرح: هذه العملية متاحة لمدير العيادة فقط.');
    }
    throw new Error(msg || 'تعذر حذف المستخدم.');
  }
}

/**
 * Resets a user's password via the server-side `/api/users/reset-password` endpoint.
 * Verifies the caller is an admin of the clinic, calls `supabase.auth.admin.updateUserById`,
 * and returns a one-time temporary password to be displayed to the admin once.
 */
export async function adminResetUserPassword(
  uid: string,
  tempPassword?: string
): Promise<{ tempPassword: string }> {
  const supabase = requireSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    throw new Error('انتهت صلاحية جلسة تسجيل الدخول. يرجى تسجيل الدخول مجدداً.');
  }

  let response: Response;
  try {
    response = await fetch('/api/users/reset-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        uid,
        tempPassword,
        clinicId,
      }),
    });
  } catch {
    throw new Error('إعادة تعيين كلمة المرور تعمل بعد نشر النظام على الخادم');
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.tempPassword) {
    const serverMsg = String(payload.error || payload.message || '');
    if (
      response.status === 404 ||
      serverMsg.includes('SUPABASE_SERVICE_ROLE_KEY') ||
      serverMsg.includes('متغيرات بيئة Supabase غير مكتملة')
    ) {
      throw new Error('إعادة تعيين كلمة المرور تعمل بعد نشر النظام على الخادم');
    }
    throw new Error(serverMsg || 'تعذر إعادة تعيين كلمة المرور المؤقتة.');
  }

  return { tempPassword: String(payload.tempPassword) };
}
