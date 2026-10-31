import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, type DocumentData } from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { createManagedUser, updateManagedUser, deleteManagedUser } from '../../services/auth';
import type { UserRole } from '../../types/database';
import {
  ALL_SYSTEM_SCREENS,
  CustomPermissionsMap,
  getDefaultAllowedScreens,
  normalizeRole,
  Role,
  ROLE_LABELS,
  SystemScreenDef,
} from '../../permissions';
import { usePermissions } from '../../context/AuthContext';
import { PermissionGate } from '../auth/PermissionGate';
import { ScreenPermissionsModal } from './ScreenPermissionsModal';
import { ChangePasswordModal } from './ChangePasswordModal';
import { AdminRecoveryModal } from './AdminRecoveryModal';

type ManagedUser = {
  uid: string;
  username: string;
  displayName: string;
  email: string;
  role: UserRole;
  active: boolean;
  allowedScreens?: string[];
  customPermissions?: CustomPermissionsMap;
};

export const UserManagementPanel: React.FC = () => {
  const { hasPermission, role: currentRole } = usePermissions();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('SECRETARY');
  const [busy, setBusy] = useState(false);
  const [actionUserId, setActionUserId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Editing inline state
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('SECRETARY');

  // Screen Permissions Modal State (Granular 4-action modal)
  const [screensModalUser, setScreensModalUser] = useState<ManagedUser | null>(null);

  // Security modals state
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showAdminRecoveryModal, setShowAdminRecoveryModal] = useState(false);

  // New User Form Custom Screens
  const [createAllowedScreens, setCreateAllowedScreens] = useState<string[]>(
    getDefaultAllowedScreens('secretary')
  );
  const [showCreateCustomScreens, setShowCreateCustomScreens] = useState(false);

  // Confirmation Modals State
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);
  const [userToDeactivate, setUserToDeactivate] = useState<ManagedUser | null>(null);
  const [roleModalTarget, setRoleModalTarget] = useState<{
    user: ManagedUser;
    selectedRole: UserRole;
  } | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);

  useEffect(() => {
    if (!db) return;
    return onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setUsers(
          snapshot.docs.map((item) => ({
            uid: item.id,
            ...(item.data() as DocumentData),
          })) as ManagedUser[]
        );
      },
      (reason) => setError(reason.message)
    );
  }, []);

  const currentUid = auth?.currentUser?.uid;

  // 1. Create user
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasPermission('users.create')) {
      setError('ليس لديك صلاحية لإضافة مستخدم جديد.');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await createManagedUser({
        username,
        displayName,
        password,
        role,
        allowedScreens: createAllowedScreens,
      });
      setUsername('');
      setDisplayName('');
      setPassword('');
      setCreateAllowedScreens(getDefaultAllowedScreens('secretary'));
      setShowCreateCustomScreens(false);
      setMessage(`تم إنشاء المستخدم "${displayName}" وتعيين دوره (${roleLabel(role)}) وتخصيص صفحات النظام بنجاح.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إنشاء المستخدم.');
    } finally {
      setBusy(false);
    }
  };

  // Screen Permissions Management (Dynamic Screen Assignment)
  const openScreensModal = (user: ManagedUser) => {
    if (!hasPermission('roles.manage') && !hasPermission('users.edit')) {
      setError('ليس لديك صلاحية لإدارة صلاحيات صفحات المستخدمين.');
      return;
    }
    setScreensModalUser(user);
    setError('');
  };

  // 2. Start inline edit
  const handleStartEdit = (user: ManagedUser) => {
    setEditingUid(user.uid);
    setEditDisplayName(user.displayName || user.username);
    setEditRole(normalizeRole(user.role).toUpperCase() as UserRole);
    setError('');
    setMessage('');
  };

  const handleCancelEdit = () => {
    setEditingUid(null);
    setEditDisplayName('');
  };

  // 3. Save inline edit
  const handleSaveEdit = async (uid: string) => {
    if (!hasPermission('users.edit')) {
      setError('ليس لديك صلاحية لتعديل بيانات المستخدم.');
      return;
    }
    if (!editDisplayName.trim()) {
      setError('الاسم الظاهر لا يمكن أن يكون فارغاً.');
      return;
    }

    const targetUser = users.find((u) => u.uid === uid);
    if (targetUser && normalizeRole(targetUser.role) === 'admin' && normalizeRole(editRole) !== 'admin') {
      // Prompt confirmation before changing admin role
      setRoleModalTarget({ user: targetUser, selectedRole: editRole });
      return;
    }

    setActionUserId(uid);
    setError('');
    setMessage('');
    try {
      await updateManagedUser(uid, {
        displayName: editDisplayName.trim(),
        role: editRole,
      });
      setEditingUid(null);
      setMessage('تم تحديث بيانات المستخدم والصلاحية بنجاح.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث بيانات المستخدم.');
    } finally {
      setActionUserId(null);
    }
  };

  // 4. Role Change Modal & Direct Firestore Save
  const openRoleChangeModal = (user: ManagedUser, presetRole?: UserRole) => {
    if (!hasPermission('roles.manage')) {
      setError('ليس لديك صلاحية لتعديل أدوار وصلاحيات المستخدمين.');
      return;
    }
    if (normalizeRole(user.role) === 'admin') {
      setError('دور المدير ثابت ومحمي في قاعدة البيانات ولا يمكن تعديله.');
      return;
    }
    const currentNormalized = normalizeRole(user.role);
    const initialRole =
      presetRole ||
      (currentNormalized === 'admin'
        ? 'ADMIN'
        : currentNormalized === 'doctor'
        ? 'DOCTOR'
        : 'SECRETARY');
    setRoleModalTarget({
      user,
      selectedRole: initialRole,
    });
    setError('');
  };

  const handleConfirmRoleSave = async () => {
    if (!roleModalTarget) return;
    const { user, selectedRole: newRole } = roleModalTarget;

    // Guard: Prevent changing any admin account's role
    if (normalizeRole(user.role) === 'admin') {
      setError('دور المدير ثابت ومحمي في قاعدة البيانات ولا يمكن تعديله لأي حساب مدير.');
      return;
    }

    setIsSavingRole(true);
    setActionUserId(user.uid);
    setError('');
    setMessage('');
    try {
      await updateManagedUser(user.uid, { role: newRole });
      setMessage(
        `تم حفظ الدور الجديد للمستخدم "${user.displayName || user.username}" (${roleLabel(newRole)}) في Firestore بنجاح.`
      );
      setRoleModalTarget(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تغيير صلاحية المستخدم في قاعدة البيانات.');
    } finally {
      setIsSavingRole(false);
      setActionUserId(null);
    }
  };

  // 5. Toggle Active (Confirmation before disabling)
  const handleToggleActiveClick = (user: ManagedUser) => {
    if (!hasPermission('users.disable')) {
      setError('ليس لديك صلاحية لتعديل حالة تفعيل المستخدمين.');
      return;
    }
    if (user.uid === currentUid) {
      setError('لا يمكنك تعطيل حسابك الحالي المسجل به في النظام.');
      return;
    }
    if (normalizeRole(user.role) === 'admin') {
      setError('لا يمكن تعطيل حساب المدير. حسابات المديرين محمية دائماً ضد التعطيل.');
      return;
    }

    const isCurrentlyActive = user.active !== false;
    if (isCurrentlyActive) {
      // Require confirmation before deactivation
      setUserToDeactivate(user);
    } else {
      // Re-activating is safe to execute directly
      void executeToggleActive(user, true);
    }
  };

  const executeToggleActive = async (user: ManagedUser, newActiveState: boolean) => {
    setActionUserId(user.uid);
    setError('');
    setMessage('');
    try {
      await updateManagedUser(user.uid, { active: newActiveState });
      setMessage(
        newActiveState
          ? `تم تفعيل حساب "${user.displayName || user.username}" بنجاح.`
          : `تم تعطيل حساب "${user.displayName || user.username}" ومنعه من تسجيل الدخول.`
      );
      setUserToDeactivate(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحديث حالة تفعيل المستخدم.');
    } finally {
      setActionUserId(null);
    }
  };

  // 6. Delete user
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    if (!hasPermission('users.delete')) {
      setError('ليس لديك صلاحية لحذف المستخدمين.');
      setUserToDelete(null);
      return;
    }
    if (userToDelete.uid === currentUid) {
      setError('لا يمكنك حذف حسابك الحالي المسجل به.');
      setUserToDelete(null);
      return;
    }

    setActionUserId(userToDelete.uid);
    setError('');
    setMessage('');
    try {
      await deleteManagedUser(userToDelete.uid, userToDelete.username);
      setMessage(`تم حذف حساب المستخدم "${userToDelete.displayName || userToDelete.username}" نهائياً.`);
      setUserToDelete(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حذف المستخدم.');
    } finally {
      setActionUserId(null);
    }
  };

  const roleLabel = (r: unknown) => {
    const norm = normalizeRole(r);
    return ROLE_LABELS[norm] || norm;
  };

  const roleBadgeClass = (r: unknown) => {
    const norm = normalizeRole(r);
    switch (norm) {
      case 'admin':
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30';
      case 'doctor':
        return 'bg-[#00c2cb]/15 text-[#008f97] dark:text-[#45dee7] border border-[#00c2cb]/30';
      case 'secretary':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
    }
  };

  return (
    <section className="space-y-6 rounded-2xl border border-[#00c2cb]/20 bg-white dark:bg-[#111A2E] p-6 shadow-sm" dir="rtl">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-[#dde2f5]">
              <span className="material-symbols-outlined text-[#00c2cb]">manage_accounts</span>
              <span>إدارة المستخدمين والصلاحيات (User & Role Management)</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#859394] mt-1">
              إدارة حسابات الفريق وتعيين الأدوار والصلاحيات الدقيقة (عرض، إضافة، تعديل، حذف) مع حماية الحسابات.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowChangePasswordModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 dark:border-white/15 bg-white dark:bg-[#161f33] text-xs font-bold text-slate-700 dark:text-slate-200 hover:border-[#00c2cb] transition-colors cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-sm text-[#00c2cb]">key</span>
              <span>تغيير كلمة المرور</span>
            </button>

            {normalizeRole(currentRole) === 'admin' && (
              <button
                type="button"
                onClick={() => setShowAdminRecoveryModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-purple-500/30 bg-purple-500/10 text-xs font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-500/20 transition-colors cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-sm text-purple-500">encrypted</span>
                <span>رمز استرداد المدير (PBKDF2)</span>
              </button>
            )}

            <span className="text-xs px-3 py-1 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20">
              مخصصة لمدير النظام فقط
            </span>
          </div>
        </div>
      </div>

      {/* Create New User Form (Guarded by users.create) */}
      <PermissionGate permission="users.create">
        <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 bg-slate-50 dark:bg-[#0c1322]">
          <h3 className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-[#00c2cb]">person_add</span>
            <span>إضافة مستخدم جديد إلى المنظومة:</span>
          </h3>
          <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
            <label className="text-xs font-bold">
              اسم المستخدم (Username)
              <input
                required
                pattern="[A-Za-z0-9._-]{3,32}"
                placeholder="مثال: dr_ahmed"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111A2E] p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                dir="ltr"
              />
            </label>
            <label className="text-xs font-bold">
              الاسم الظاهر (Display Name)
              <input
                required
                placeholder="د. أحمد سليمان"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111A2E] p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
              />
            </label>
            <label className="text-xs font-bold">
              كلمة المرور (8 أحرف فأكثر)
              <input
                required
                minLength={8}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111A2E] p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#00c2cb]"
                dir="ltr"
              />
            </label>
            <label className="text-xs font-bold">
              الدور والصلاحية (Role)
              <select
                value={role}
                onChange={(e) => {
                  const newRole = e.target.value as UserRole;
                  setRole(newRole);
                  setCreateAllowedScreens(getDefaultAllowedScreens(normalizeRole(newRole)));
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111A2E] p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#00c2cb] cursor-pointer"
              >
                <option value="SECRETARY">سكرتير (استقبال وحجوزات ومدفوعات)</option>
                <option value="DOCTOR">طبيب (كشف وروشتات وسجل طبي)</option>
                <option value="ADMIN">مدير (صلاحيات كاملة للمنظومة)</option>
              </select>
            </label>
            <button
              disabled={busy}
              type="submit"
              className="rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] px-4 py-2.5 font-bold text-xs text-slate-950 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
            >
              {busy ? 'جارٍ الإنشاء...' : '+ إنشاء المستخدم'}
            </button>

            {/* Expandable Screen Selection for New User */}
            <div className="col-span-1 md:col-span-2 xl:col-span-5 pt-2 border-t border-slate-200 dark:border-white/5">
              <button
                type="button"
                onClick={() => setShowCreateCustomScreens(!showCreateCustomScreens)}
                className="text-xs font-bold text-[#008f97] dark:text-[#45dee7] flex items-center gap-1.5 hover:underline cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">
                  {showCreateCustomScreens ? 'expand_less' : 'tune'}
                </span>
                <span>
                  {showCreateCustomScreens
                    ? 'إخفاء تخصيص صفحات النظام لهذا الحساب'
                    : `تخصيص صفحات النظام المسموحة قبل الإنشاء (${createAllowedScreens.length} من ${ALL_SYSTEM_SCREENS.length} صفحة محددة)`}
                </span>
              </button>

              {showCreateCustomScreens && (
                <div className="mt-3 p-3 bg-white dark:bg-[#111A2E] rounded-xl border border-slate-200 dark:border-white/10 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      حدد الصفحات التي تظهر في قائمة هذا المستخدم فور إنشائه:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateAllowedScreens(ALL_SYSTEM_SCREENS.map((s) => s.id))}
                        className="text-[11px] text-[#00c2cb] hover:underline"
                      >
                        تحديد الكل
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setCreateAllowedScreens([])}
                        className="text-[11px] text-rose-400 hover:underline"
                      >
                        إلغاء الكل
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {ALL_SYSTEM_SCREENS.map((screen) => {
                      const isChecked = createAllowedScreens.includes(screen.id);
                      return (
                        <label
                          key={screen.id}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-[#00c2cb]/10 border-[#00c2cb]/40 text-slate-900 dark:text-white font-bold'
                              : 'bg-slate-50 dark:bg-[#0c1322] border-slate-200 dark:border-white/5 text-slate-500'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setCreateAllowedScreens((prev) =>
                                prev.includes(screen.id)
                                  ? prev.filter((id) => id !== screen.id)
                                  : [...prev, screen.id]
                              );
                            }}
                            className="rounded accent-[#00c2cb]"
                          />
                          <span className="material-symbols-outlined text-sm">{screen.icon}</span>
                          <span className="truncate">{screen.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </PermissionGate>

      {/* Messages */}
      {message && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-base">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1322] text-slate-600 dark:text-[#859394] text-right font-bold">
              <th className="p-3">اسم المستخدم</th>
              <th className="p-3">الاسم الظاهر والدور</th>
              <th className="p-3">صفحات النظام المسموحة</th>
              <th className="p-3">حالة الحساب</th>
              <th className="p-3 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400">
                  لا يوجد مستخدمون مسجلون حتى الآن.
                </td>
              </tr>
            )}
            {users.map((user) => {
              const isCurrentUser = user.uid === currentUid;
              const isEditing = editingUid === user.uid;
              const isBusyThis = actionUserId === user.uid;
              const isActive = user.active !== false;
              const normalizedUserRole = normalizeRole(user.role);
              const isUserAdmin = normalizedUserRole === 'admin' || user.role === 'ADMIN' || user.role === 'admin';

              if (isEditing) {
                return (
                  <tr key={user.uid} className="bg-[#00c2cb]/5 border-y border-[#00c2cb]/30">
                    <td className="p-3 font-mono text-slate-500" dir="ltr">
                      @{user.username}
                    </td>
                    <td className="p-3">
                      <div className="space-y-1.5">
                        <div>
                          <label className="text-[10px] text-slate-400 block">الاسم الظاهر:</label>
                          <input
                            type="text"
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111A2E] p-2 text-xs focus:ring-1 focus:ring-[#00c2cb] outline-none font-bold"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block">الدور:</label>
                          <select
                            disabled={isUserAdmin}
                            value={editRole}
                            onChange={(e) => setEditRole(e.target.value as UserRole)}
                            className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111A2E] p-1.5 text-xs focus:ring-1 focus:ring-[#00c2cb] outline-none font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="SECRETARY">سكرتير</option>
                            <option value="DOCTOR">طبيب</option>
                            <option value="ADMIN">مدير</option>
                          </select>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => openScreensModal(user)}
                        className="text-xs text-[#00c2cb] hover:underline font-bold"
                      >
                        تخصيص الصفحات...
                      </button>
                    </td>
                    <td className="p-3">
                      <span className="text-[11px] text-slate-400 font-bold">وضع التعديل</span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          disabled={isBusyThis}
                          onClick={() => handleSaveEdit(user.uid)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                        >
                          <span className="material-symbols-outlined text-sm">check</span>
                          <span>حفظ</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/15 text-slate-700 dark:text-[#dde2f5] text-xs transition-all cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={user.uid} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  {/* 1. اسم المستخدم */}
                  <td className="p-3 font-mono text-slate-700 dark:text-[#859394] font-bold" dir="ltr">
                    @{user.username || 'user'}
                  </td>

                  {/* 2. الاسم الظاهر والدور */}
                  <td className="p-3">
                    <div className="space-y-1">
                      <div className="font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                        <span>{user.displayName || user.username}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7] font-bold px-2 py-0.5 rounded-full">
                            حسابك الحالي
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap ${roleBadgeClass(user.role)}`}>
                          {roleLabel(user.role)}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* 3. صفحات النظام المسموحة (تخصيص مباشر لكل حساب) */}
                  <td className="p-3">
                    {(() => {
                      const screens =
                        user.allowedScreens && Array.isArray(user.allowedScreens) && user.allowedScreens.length > 0
                          ? user.allowedScreens
                          : getDefaultAllowedScreens(user.role);
                      const count = screens.length;
                      const hasClinicalExam = screens.includes('clinical-exam');
                      return (
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => openScreensModal(user)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#00c2cb]/40 bg-[#00c2cb]/10 hover:bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7] text-xs font-bold transition-all cursor-pointer active:scale-95 shadow-2xs"
                            title="فتح نافذة اختيار وتخصيص صفحات وشاشات النظام لهذا الحساب"
                          >
                            <span className="material-symbols-outlined text-sm">tune</span>
                            <span>{count} من {ALL_SYSTEM_SCREENS.length} صفحة</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00c2cb]/20 font-mono">تخصيص</span>
                          </button>
                          <div className="text-[10px] flex items-center gap-1 font-semibold">
                            {hasClinicalExam ? (
                              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">stethoscope</span>
                                <span>الكشف الطبي: متاح</span>
                              </span>
                            ) : (
                              <span className="text-rose-500 dark:text-rose-400 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-xs">block</span>
                                <span>الكشف الطبي: محجوب 🚫</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </td>

                  {/* 4. حالة الحساب */}
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        isActive
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                      <span>{isActive ? 'نشط' : 'معطل'}</span>
                    </span>
                  </td>

                  {/* 5. الإجراءات (تعديل الدور، تعديل البيانات، تعطيل/تفعيل، حذف) */}
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {/* زر تعديل الدور المباشر */}
                      <PermissionGate permission="roles.manage">
                        <button
                          type="button"
                          disabled={isBusyThis || isUserAdmin}
                          onClick={() => openRoleChangeModal(user)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                            isUserAdmin
                              ? 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-50'
                              : 'border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/15 text-purple-600 dark:text-purple-400 cursor-pointer disabled:opacity-50'
                          }`}
                          title={isUserAdmin ? 'دور المدير ثابت ولا يمكن تعديله' : 'تعديل الدور وتعيين الصلاحيات'}
                        >
                          <span className="material-symbols-outlined text-xs">
                            {isUserAdmin ? 'lock' : 'admin_panel_settings'}
                          </span>
                          <span>{isUserAdmin ? 'دور ثابت' : 'تغيير الدور'}</span>
                        </button>
                      </PermissionGate>

                      {/* تعديل البيانات (الاسم) */}
                      <PermissionGate permission="users.edit">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(user)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-[#dde2f5] transition-colors cursor-pointer"
                          title="تعديل الاسم الظاهر"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                      </PermissionGate>

                      {/* تعطيل / تفعيل */}
                      <PermissionGate permission="users.disable">
                        <button
                          type="button"
                          disabled={isCurrentUser || isBusyThis || isUserAdmin}
                          onClick={() => handleToggleActiveClick(user)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                            isCurrentUser || isUserAdmin
                              ? 'border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-40'
                              : isActive
                              ? 'border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer'
                              : 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer'
                          }`}
                          title={
                            isCurrentUser
                              ? 'لا يمكنك تعطيل حسابك الحالي'
                              : isUserAdmin
                              ? 'لا يمكن تعطيل حساب المدير'
                              : isActive
                              ? 'تعطيل الحساب ومنعه من الدخول'
                              : 'إعادة تفعيل الحساب'
                          }
                        >
                          {isActive ? 'تعطيل' : 'تفعيل'}
                        </button>
                      </PermissionGate>

                      {/* حذف */}
                      <PermissionGate permission="users.delete">
                        <button
                          type="button"
                          disabled={isCurrentUser || isBusyThis}
                          onClick={() => setUserToDelete(user)}
                          className="p-1.5 rounded-lg border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title={isCurrentUser ? 'لا يمكنك حذف حسابك الحالي' : 'حذف المستخدم نهائياً'}
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal: تعديل الدور وحفظه فورياً في Firestore مع نوافذ تأكيد للأدوار الإدارية */}
      {roleModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-purple-500/30 bg-white dark:bg-[#111A2E] p-6 shadow-2xl text-right space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2.5 text-purple-600 dark:text-purple-400">
                <span className="material-symbols-outlined text-2xl">admin_panel_settings</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#dde2f5]">
                  تعديل دور وصلاحيات المستخدم في Firestore
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRoleModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            {/* Target User Info */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0c1322] border border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{roleModalTarget.user.displayName || roleModalTarget.user.username}</span>
                  <span className="text-xs font-mono text-slate-400" dir="ltr">
                    @{roleModalTarget.user.username}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-[#859394] mt-0.5" dir="ltr">
                  {roleModalTarget.user.email}
                </div>
              </div>
              <div className="text-left">
                <span className="text-[10px] text-slate-400 block mb-1">الدور الحالي:</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${roleBadgeClass(roleModalTarget.user.role)}`}>
                  {roleLabel(roleModalTarget.user.role)}
                </span>
              </div>
            </div>

            {/* Role Options */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-[#dde2f5] block">
                اختر الدور الجديد للمستخدم:
              </label>

              <div className="grid grid-cols-1 gap-2">
                {/* 1. ADMIN */}
                <div
                  onClick={() => setRoleModalTarget({ ...roleModalTarget, selectedRole: 'ADMIN' })}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    normalizeRole(roleModalTarget.selectedRole) === 'admin'
                      ? 'border-purple-500 bg-purple-500/10 shadow-xs ring-1 ring-purple-500/50'
                      : 'border-slate-200 dark:border-white/10 hover:border-purple-500/40 bg-slate-50/50 dark:bg-white/[0.02]'
                  }`}
                >
                  <input
                    type="radio"
                    name="roleSelection"
                    checked={normalizeRole(roleModalTarget.selectedRole) === 'admin'}
                    onChange={() => setRoleModalTarget({ ...roleModalTarget, selectedRole: 'ADMIN' })}
                    className="mt-1 accent-purple-600"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-purple-600 dark:text-purple-400">
                      <span className="material-symbols-outlined text-base">verified_user</span>
                      <span>مدير النظام (ADMIN)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#859394] mt-0.5 leading-relaxed">
                      صلاحيات إدارة عليا شاملة: إضافة وحذف وتعديل المستخدمين، تعديل الإعدادات والأسعار، واستعراض سجلات النظام.
                    </p>
                  </div>
                </div>

                {/* 2. DOCTOR */}
                <div
                  onClick={() => setRoleModalTarget({ ...roleModalTarget, selectedRole: 'DOCTOR' })}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    normalizeRole(roleModalTarget.selectedRole) === 'doctor'
                      ? 'border-[#00c2cb] bg-[#00c2cb]/10 shadow-xs ring-1 ring-[#00c2cb]/50'
                      : 'border-slate-200 dark:border-white/10 hover:border-[#00c2cb]/40 bg-slate-50/50 dark:bg-white/[0.02]'
                  }`}
                >
                  <input
                    type="radio"
                    name="roleSelection"
                    checked={normalizeRole(roleModalTarget.selectedRole) === 'doctor'}
                    onChange={() => setRoleModalTarget({ ...roleModalTarget, selectedRole: 'DOCTOR' })}
                    className="mt-1 accent-[#00c2cb]"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-[#008f97] dark:text-[#45dee7]">
                      <span className="material-symbols-outlined text-base">stethoscope</span>
                      <span>طبيب العيادة (DOCTOR)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#859394] mt-0.5 leading-relaxed">
                      صلاحيات إكلينيكية كاملة: فحص المريض، كتابة التشخيص والروشتات، طلب التحاليل والأشعة، ومراجعة السجلات الطبية.
                    </p>
                  </div>
                </div>

                {/* 3. SECRETARY */}
                <div
                  onClick={() => setRoleModalTarget({ ...roleModalTarget, selectedRole: 'SECRETARY' })}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    normalizeRole(roleModalTarget.selectedRole) === 'secretary'
                      ? 'border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/50'
                      : 'border-slate-200 dark:border-white/10 hover:border-amber-500/40 bg-slate-50/50 dark:bg-white/[0.02]'
                  }`}
                >
                  <input
                    type="radio"
                    name="roleSelection"
                    checked={normalizeRole(roleModalTarget.selectedRole) === 'secretary'}
                    onChange={() => setRoleModalTarget({ ...roleModalTarget, selectedRole: 'SECRETARY' })}
                    className="mt-1 accent-amber-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-600 dark:text-amber-400">
                      <span className="material-symbols-outlined text-base">badge</span>
                      <span>سكرتير الاستقبال (SECRETARY)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-[#859394] mt-0.5 leading-relaxed">
                      تسجيل المرضى والزيارات، حجز المواعيد، إدارة طابور الانتظار، تحصيل الفواتير، تسجيل النثريات، وتقفيل الوردية.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* نافذة التأكيد الإدارية للأدوار الحساسة */}
            {(() => {
              const currentNorm = normalizeRole(roleModalTarget.user.role);
              const targetNorm = normalizeRole(roleModalTarget.selectedRole);
              const isSelf = roleModalTarget.user.uid === currentUid;

              // 1. حماية الحساب الحالي من سحب صلاحية المدير ذاتياً
              if (isSelf && currentNorm === 'admin' && targetNorm !== 'admin') {
                return (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-xl shrink-0">block</span>
                    <div className="leading-relaxed font-bold">
                      لا يمكنك سحب صلاحية المدير من حسابك الحالي المسجل به الآن للحفاظ على استمرارية إدارة المنظومة وعدم حرمان نفسك من الصلاحيات الإدارية.
                    </div>
                  </div>
                );
              }

              // 2. تأكيد ترقية إلى دور مدير (Admin)
              if (currentNorm !== 'admin' && targetNorm === 'admin') {
                return (
                  <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-xl text-purple-600 dark:text-purple-400 shrink-0">warning</span>
                    <div className="leading-relaxed">
                      <strong className="font-bold text-purple-800 dark:text-purple-200 block mb-0.5">
                        ⚠️ نافذة تأكيد إدارية: ترقية إلى مدير النظام (ADMIN)
                      </strong>
                      أنت على وشك ترقية هذا المستخدم إلى رتبة <strong>مدير النظام</strong>. سيمنحه هذا صلاحيات كاملة لإدارة حسابات المستخدمين، تعديل الأدوار، التحكم في الإعدادات، ومراجعة كافة سجلات العيادة.
                    </div>
                  </div>
                );
              }

              // 3. تأكيد سحب دور المدير (Admin)
              if (currentNorm === 'admin' && targetNorm !== 'admin') {
                return (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-xl text-amber-600 dark:text-amber-400 shrink-0">warning</span>
                    <div className="leading-relaxed">
                      <strong className="font-bold text-amber-800 dark:text-amber-200 block mb-0.5">
                        ⚠️ نافذة تأكيد إدارية: سحب صلاحية المدير
                      </strong>
                      أنت على وشك سحب صلاحيات الإدارة من المستخدم وتحويله إلى دور <strong>{roleLabel(roleModalTarget.selectedRole)}</strong>. سيتم تقييد وصوله الإداري فوراً وحرمانه من إدارة المستخدمين وإعدادات العيادة فور الحفظ.
                    </div>
                  </div>
                );
              }

              return null;
            })()}

            {/* أزرار الحفظ والإلغاء الصريحة */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                disabled={isSavingRole}
                onClick={() => setRoleModalTarget(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={
                  isSavingRole ||
                  (roleModalTarget.user.uid === currentUid &&
                    normalizeRole(roleModalTarget.user.role) === 'admin' &&
                    normalizeRole(roleModalTarget.selectedRole) !== 'admin')
                }
                onClick={handleConfirmRoleSave}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-md shadow-[#00c2cb]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">
                  {isSavingRole ? 'sync' : 'save'}
                </span>
                <span>{isSavingRole ? 'جارٍ الحفظ في Firestore...' : 'حفظ الدور فورياً في Firestore'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal 2: Deactivating Account */}
      {userToDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/40 bg-white dark:bg-[#111A2E] p-6 shadow-2xl text-right space-y-4">
            <div className="flex items-center gap-3 text-amber-500">
              <span className="material-symbols-outlined text-3xl">person_off</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#dde2f5]">تأكيد تعطيل حساب المستخدم</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#859394] leading-relaxed">
              هل أنت متأكد من تعطيل حساب المستخدم{' '}
              <strong className="text-slate-900 dark:text-white font-bold">{userToDeactivate.displayName || userToDeactivate.username}</strong> ({userToDeactivate.email})؟
              <br /><br />
              عند التعطيل، سيتم إنهاء جلسة المستخدم فوراً ومنعه من تسجيل الدخول إلى النظام حتى يعاد تفعيله من هذه اللوحة.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setUserToDeactivate(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => executeToggleActive(userToDeactivate, false)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
              >
                نعم، عطل الحساب الآن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal 3: Deleting User */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 bg-white dark:bg-[#111A2E] p-6 shadow-2xl text-right space-y-4">
            <div className="flex items-center gap-3 text-rose-500">
              <span className="material-symbols-outlined text-3xl">warning</span>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#dde2f5]">تأكيد حذف المستخدم نهائياً</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-[#859394] leading-relaxed">
              هل أنت متأكد من حذف المستخدم{' '}
              <strong className="text-slate-900 dark:text-white font-bold">{userToDelete.displayName || userToDelete.username}</strong> ({userToDelete.email})؟
              <br /><br />
              هذا الإجراء نهائي ولا يمكن التراجع عنه.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-[#859394] hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer shadow-sm"
              >
                نعم، احذف المستخدم
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Dynamic Granular Permissions Customizer */}
      {screensModalUser && (
        <ScreenPermissionsModal
          user={screensModalUser}
          onClose={() => setScreensModalUser(null)}
          onSaved={(msg) => {
            setMessage(msg);
            setScreensModalUser(null);
          }}
          onError={(err) => setError(err)}
        />
      )}

      {/* Modal 5: Change Password */}
      {showChangePasswordModal && (
        <ChangePasswordModal
          onClose={() => setShowChangePasswordModal(false)}
          onSuccess={(msg) => setMessage(msg)}
        />
      )}

      {/* Modal 6: Admin Recovery Setup */}
      {showAdminRecoveryModal && (
        <AdminRecoveryModal
          onClose={() => setShowAdminRecoveryModal(false)}
          onSuccess={(msg) => setMessage(msg)}
        />
      )}
    </section>
  );
};
