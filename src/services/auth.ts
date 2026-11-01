import type { User as SupabaseUser } from '@supabase/supabase-js';
import { requireSupabase, clinicId } from './supabase';
import type { UserRole } from '../types/database';
import type { CustomPermissionsMap } from '../permissions';

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
 * Looks up the username in the `usernames` table first, then signs in with the
 * internal email `${username_lower}@${INTERNAL_EMAIL_DOMAIN}`.
 * Self-registration from the browser is strictly disabled.
 */
export async function loginWithUsername(username: string, password: string): Promise<AuthUser> {
  const supabase = requireSupabase();
  const unameLower = normalizeUsername(username);
  if (!unameLower || !password) {
    throw new Error('يرجى إدخال اسم المستخدم وكلمة المرور.');
  }

  // Check usernames table first (if accessible via RLS or RPC)
  const { data: usernameRow, error: usernameErr } = await supabase
    .from('usernames')
    .select('username_lower, user_id')
    .eq('username_lower', unameLower)
    .maybeSingle();

  // If the table is readable and explicitly confirms the username doesn't exist
  if (!usernameErr && usernameRow === null) {
    // Proceed to signInWithPassword with the deterministic internal email so timing/error behavior stays consistent,
    // or if RLS blocks direct unauthenticated select on `usernames`, signInWithPassword handles authentication.
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
 * Creates a managed user via the server-side `/api/users/create` endpoint.
 * Browser self-signup is completely prohibited.
 */
export async function createManagedUser(params: {
  username: string;
  displayName: string;
  password: string;
  role: UserRole;
  allowedScreens?: string[];
  customPermissions?: CustomPermissionsMap;
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
  if (!accessToken) {
    throw new Error('انتهت صلاحية جلسة تسجيل الدخول. يرجى تسجيل الدخول مجدداً.');
  }

  const response = await fetch('/api/users/create', {
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
      clinicId,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || payload.message || 'تعذر إنشاء حساب المستخدم.');
  }
}

export async function updateManagedUser(
  uid: string,
  updates: {
    displayName?: string;
    role?: UserRole;
    active?: boolean;
    allowedScreens?: string[];
    customPermissions?: CustomPermissionsMap;
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
}

export async function deleteManagedUser(uid: string, username?: string): Promise<void> {
  const supabase = requireSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  const currentUid = sessionData.session?.user?.id;
  const accessToken = sessionData.session?.access_token;

  if (currentUid === uid) {
    throw new Error('لا يمكنك حذف الحساب المسجل به حالياً.');
  }
  if (!accessToken) {
    throw new Error('انتهت صلاحية جلسة تسجيل الدخول. يرجى تسجيل الدخول مجدداً.');
  }

  const response = await fetch('/api/users/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ uid, username, clinicId }),
  });

  let serverError = '';
  try {
    const rawText = await response.text();
    try {
      const parsed = JSON.parse(rawText);
      serverError = parsed.error || parsed.message;
    } catch {
      serverError = rawText.length < 250 ? rawText : '';
    }
  } catch {}

  if (!response.ok) {
    const isConfigError =
      response.status === 404 ||
      serverError.includes('متغيرات بيئة') ||
      serverError.includes('غير مكتملة') ||
      serverError.includes('غير متوفرة');

    if (isConfigError) {
      await supabase.from('clinic_members').delete().eq('clinic_id', clinicId).eq('user_id', uid);
      if (username) {
        await supabase.from('usernames').delete().eq('username_lower', normalizeUsername(username));
      }
      throw new Error(
        'تم حذف المستخدم من سجلات العيادة بنجاح. لحذفه تلقائياً من صفحة Authentication أيضاً، أضف مفتاح الخدمة في Vercel.'
      );
    }

    throw new Error(serverError || `تعذر حذف المستخدم (رمز ${response.status}).`);
  }

  // Ensure clinic_members & usernames records are cleaned up
  await supabase.from('clinic_members').delete().eq('clinic_id', clinicId).eq('user_id', uid);
  if (username) {
    await supabase.from('usernames').delete().eq('username_lower', normalizeUsername(username));
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

  const response = await fetch('/api/users/reset-password', {
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

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.tempPassword) {
    throw new Error(payload.error || payload.message || 'تعذر إعادة تعيين كلمة المرور المؤقتة.');
  }

  return { tempPassword: String(payload.tempPassword) };
}
