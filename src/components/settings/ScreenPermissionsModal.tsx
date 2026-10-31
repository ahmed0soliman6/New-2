import React, { useState } from 'react';
import {
  ALL_SYSTEM_SCREENS,
  CustomPermissionsMap,
  getDefaultRolePermissions,
  normalizeRole,
  Role,
  ROLE_LABELS,
  ScreenAction,
  ScreenPermissionSet,
  SystemScreenDef,
} from '../../permissions';
import { updateManagedUser } from '../../services/auth';

interface ScreenPermissionsModalProps {
  user: {
    uid: string;
    username: string;
    displayName: string;
    email: string;
    role: unknown;
    allowedScreens?: string[];
    customPermissions?: CustomPermissionsMap;
  };
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (err: string) => void;
}

export const ScreenPermissionsModal: React.FC<ScreenPermissionsModalProps> = ({
  user,
  onClose,
  onSaved,
  onError,
}) => {
  const normRole = normalizeRole(user.role);
  const isAdminAccount = normRole === 'admin' || (user?.role as string) === 'ADMIN' || (user?.role as string) === 'admin';

  // Initialize permissions state
  const [permissions, setPermissions] = useState<CustomPermissionsMap>(() => {
    // Admin accounts always have 100% full permissions across all screens
    if (isAdminAccount) {
      const perms: CustomPermissionsMap = {};
      for (const screen of ALL_SYSTEM_SCREENS) {
        perms[screen.id] = {
          view: true,
          create: true,
          update: true,
          delete: true,
        };
      }
      return perms;
    }

    if (user.customPermissions && typeof user.customPermissions === 'object') {
      const perms: CustomPermissionsMap = {};
      for (const screen of ALL_SYSTEM_SCREENS) {
        perms[screen.id] = user.customPermissions[screen.id] || {
          view: false,
          create: false,
          update: false,
          delete: false,
        };
      }
      return perms;
    }

    // If only allowedScreens was stored previously
    if (user.allowedScreens && Array.isArray(user.allowedScreens)) {
      const defaultRolePerms = getDefaultRolePermissions(normRole);
      const perms: CustomPermissionsMap = {};
      for (const screen of ALL_SYSTEM_SCREENS) {
        const isAllowed = user.allowedScreens.includes(screen.id);
        perms[screen.id] = isAllowed
          ? defaultRolePerms[screen.id] || { view: true, create: true, update: true, delete: false }
          : { view: false, create: false, update: false, delete: false };
      }
      return perms;
    }

    // Default to role standard permissions
    return getDefaultRolePermissions(normRole);
  });

  const [saving, setSaving] = useState(false);

  const handleActionToggle = (screenId: string, action: ScreenAction) => {
    if (isAdminAccount) return;

    setPermissions((prev) => {
      const current = prev[screenId] || { view: false, create: false, update: false, delete: false };
      const nextValue = !current[action];
      const updated: ScreenPermissionSet = {
        ...current,
        [action]: nextValue,
      };
      // If turning on create/update/delete, auto-enable view
      if (nextValue && action !== 'view') {
        updated.view = true;
      }
      // If turning off view, auto-disable create/update/delete
      if (!nextValue && action === 'view') {
        updated.create = false;
        updated.update = false;
        updated.delete = false;
      }
      return {
        ...prev,
        [screenId]: updated,
      };
    });
  };

  const handleToggleAllForScreen = (screenId: string) => {
    if (isAdminAccount) return;

    setPermissions((prev) => {
      const current = prev[screenId] || { view: false, create: false, update: false, delete: false };
      const hasAny = current.view || current.create || current.update || current.delete;
      const nextState = !hasAny;
      return {
        ...prev,
        [screenId]: {
          view: nextState,
          create: nextState,
          update: nextState,
          delete: nextState,
        },
      };
    });
  };

  const handleSelectAllGlobal = () => {
    if (isAdminAccount) return;

    const full: CustomPermissionsMap = {};
    for (const screen of ALL_SYSTEM_SCREENS) {
      full[screen.id] = { view: true, create: true, update: true, delete: true };
    }
    setPermissions(full);
  };

  const handleClearAllGlobal = () => {
    if (isAdminAccount) return;

    const empty: CustomPermissionsMap = {};
    for (const screen of ALL_SYSTEM_SCREENS) {
      empty[screen.id] = { view: false, create: false, update: false, delete: false };
    }
    setPermissions(empty);
  };

  const handleApplyPreset = (presetRole: Role) => {
    if (isAdminAccount) return;
    setPermissions(getDefaultRolePermissions(presetRole));
  };

  const handleSave = async () => {
    if (isAdminAccount) return;

    setSaving(true);
    try {
      const allowedScreens = Object.keys(permissions).filter(
        (screenId) => permissions[screenId]?.view
      );

      await updateManagedUser(user.uid, {
        customPermissions: permissions,
        allowedScreens,
      });

      onSaved(
        `تم حفظ الصلاحيات المخصصة للمستخدم "${user.displayName || user.username}" في Firestore بنجاح.`
      );
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تعذر حفظ الصلاحيات في قاعدة البيانات.');
    } finally {
      setSaving(false);
    }
  };

  const activeScreensCount = isAdminAccount
    ? ALL_SYSTEM_SCREENS.length
    : ALL_SYSTEM_SCREENS.filter((s) => permissions[s.id]?.view).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in overflow-y-auto">
      <div className="w-full max-w-5xl rounded-2xl border border-[#00c2cb]/40 bg-white dark:bg-[#111A2E] shadow-2xl text-right flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1322] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00c2cb]/15 text-[#008f97] dark:text-[#45dee7] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">shield_person</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2">
                <span>تخصيص صلاحيات المستخدم الدقيقة (VIEW / CREATE / UPDATE / DELETE)</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7] font-bold">
                  {activeScreensCount} من {ALL_SYSTEM_SCREENS.length} شاشة متاحة
                </span>
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-[#859394]">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {user.displayName || user.username}
                </span>
                <span dir="ltr">(@{user.username})</span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-white/10">
                  {ROLE_LABELS[normRole] || normRole}
                </span>
                <span>•</span>
                <span dir="ltr">{user.email}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Admin Permanent Lock Banner */}
        {isAdminAccount && (
          <div className="mx-5 mt-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center gap-3 text-purple-700 dark:text-purple-300">
            <span className="material-symbols-outlined text-2xl shrink-0 text-purple-600 dark:text-purple-400">
              lock
            </span>
            <div className="text-xs">
              <strong className="font-bold block text-sm mb-0.5 text-purple-900 dark:text-purple-200">
                صلاحيات المدير ثابتة ومحمية وغير قابلة للتعديل
              </strong>
              <span className="text-slate-600 dark:text-slate-300">
                حساب المدير يتمتع بصلاحيات كاملة وشاملة على جميع شاشات ووظائف النظام افتراضياً وقانونياً، ولا يمكن تقييد أو تعديل صلاحياته.
              </span>
            </div>
          </div>
        )}

        {/* Global Presets & Quick Action Bar */}
        <div className="p-4 bg-slate-100/80 dark:bg-[#161f33] border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">نماذج جاهزة:</span>
            <button
              type="button"
              disabled={isAdminAccount}
              onClick={handleSelectAllGlobal}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111A2E] border border-slate-300 dark:border-white/15 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:border-emerald-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              تحديد كل الصلاحيات (كامل)
            </button>
            <button
              type="button"
              disabled={isAdminAccount}
              onClick={handleClearAllGlobal}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111A2E] border border-slate-300 dark:border-white/15 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              إلغاء كل الصلاحيات
            </button>
            <button
              type="button"
              disabled={isAdminAccount}
              onClick={() => handleApplyPreset('doctor')}
              className="px-2.5 py-1 rounded-lg bg-[#00c2cb]/10 border border-[#00c2cb]/30 text-xs font-bold text-[#008f97] dark:text-[#45dee7] hover:bg-[#00c2cb]/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              نموذج الطبيب
            </button>
            <button
              type="button"
              disabled={isAdminAccount}
              onClick={() => handleApplyPreset('secretary')}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              نموذج السكرتير
            </button>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-[#859394]">
            {isAdminAccount
              ? 'كافة الصلاحيات ممنوحة ومقفلة بالكامل لمدير النظام'
              : 'يمكنك تخصيص كل عملية بشكل مستقل (عرض، إضافة، تعديل، حذف) لكل شاشة'}
          </div>
        </div>

        {/* Granular Screen Permission Cards List */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {ALL_SYSTEM_SCREENS.map((screen) => {
              const perm = permissions[screen.id] || {
                view: false,
                create: false,
                update: false,
                delete: false,
              };

              const isAllSelected = isAdminAccount || (perm.view && perm.create && perm.update && perm.delete);
              const hasSome = isAdminAccount || perm.view || perm.create || perm.update || perm.delete;

              return (
                <div
                  key={screen.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isAdminAccount || perm.view
                      ? 'border-[#00c2cb]/50 bg-[#00c2cb]/5 dark:bg-[#00c2cb]/10 shadow-xs'
                      : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 dark:border-white/10 pb-2.5 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="material-symbols-outlined text-lg text-[#00c2cb]">
                        {screen.icon}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-[#dde2f5] truncate">
                          {screen.title}
                        </div>
                        <span className="text-[10px] text-slate-400">{screen.categoryLabel}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isAdminAccount}
                        onClick={() => handleToggleAllForScreen(screen.id)}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors ${
                          isAdminAccount
                            ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30 cursor-not-allowed opacity-90'
                            : isAllSelected
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 cursor-pointer'
                            : hasSome
                            ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30 cursor-pointer'
                            : 'bg-slate-200 dark:bg-white/10 text-slate-500 border-slate-300 dark:border-white/15 cursor-pointer'
                        }`}
                      >
                        {isAdminAccount || isAllSelected ? 'الكل مفعل ✓' : hasSome ? 'مخصص' : 'محجوبة ✕'}
                      </button>
                    </div>
                  </div>

                  {/* Actions Checkboxes Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* 1. VIEW */}
                    <label
                      className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs select-none transition-all ${
                        isAdminAccount
                          ? 'cursor-not-allowed bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 font-bold opacity-80'
                          : perm.view
                          ? 'cursor-pointer bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 font-bold'
                          : 'cursor-pointer bg-white dark:bg-[#111A2E] border-slate-200 dark:border-white/10 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isAdminAccount ? true : perm.view}
                        disabled={isAdminAccount || saving}
                        onChange={() => handleActionToggle(screen.id, 'view')}
                        className="rounded accent-blue-600 disabled:cursor-not-allowed"
                      />
                      <span>عرض</span>
                    </label>

                    {/* 2. CREATE */}
                    <label
                      className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs select-none transition-all ${
                        isAdminAccount
                          ? 'cursor-not-allowed bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold opacity-80'
                          : perm.create
                          ? 'cursor-pointer bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'cursor-pointer bg-white dark:bg-[#111A2E] border-slate-200 dark:border-white/10 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isAdminAccount ? true : perm.create}
                        disabled={isAdminAccount || saving}
                        onChange={() => handleActionToggle(screen.id, 'create')}
                        className="rounded accent-emerald-600 disabled:cursor-not-allowed"
                      />
                      <span>إضافة</span>
                    </label>

                    {/* 3. UPDATE */}
                    <label
                      className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs select-none transition-all ${
                        isAdminAccount
                          ? 'cursor-not-allowed bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold opacity-80'
                          : perm.update
                          ? 'cursor-pointer bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                          : 'cursor-pointer bg-white dark:bg-[#111A2E] border-slate-200 dark:border-white/10 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isAdminAccount ? true : perm.update}
                        disabled={isAdminAccount || saving}
                        onChange={() => handleActionToggle(screen.id, 'update')}
                        className="rounded accent-amber-600 disabled:cursor-not-allowed"
                      />
                      <span>تعديل</span>
                    </label>

                    {/* 4. DELETE */}
                    <label
                      className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs select-none transition-all ${
                        isAdminAccount
                          ? 'cursor-not-allowed bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300 font-bold opacity-80'
                          : perm.delete
                          ? 'cursor-pointer bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300 font-bold'
                          : 'cursor-pointer bg-white dark:bg-[#111A2E] border-slate-200 dark:border-white/10 text-slate-400'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isAdminAccount ? true : perm.delete}
                        disabled={isAdminAccount || saving}
                        onChange={() => handleActionToggle(screen.id, 'delete')}
                        className="rounded accent-rose-600 disabled:cursor-not-allowed"
                      />
                      <span>حذف</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1322] flex items-center justify-between">
          <div className="text-xs text-slate-600 dark:text-[#859394]">
            <span>الشاشات المتاحة لهذا الحساب: </span>
            <strong className="text-[#008f97] dark:text-[#45dee7] font-bold">
              {activeScreensCount} شاشة
            </strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-[#859394] hover:bg-slate-200 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="button"
              disabled={isAdminAccount || saving}
              onClick={handleSave}
              title={isAdminAccount ? 'صلاحيات المدير ثابتة ومحمية لا يمكن تعديلها' : undefined}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md ${
                isAdminAccount
                  ? 'bg-slate-300 dark:bg-white/10 text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 cursor-pointer shadow-[#00c2cb]/20 disabled:opacity-50'
              }`}
            >
              <span className="material-symbols-outlined text-base">
                {isAdminAccount ? 'lock' : saving ? 'sync' : 'save'}
              </span>
              <span>
                {isAdminAccount
                  ? 'صلاحيات المدير ثابتة ومحمية 🔒'
                  : saving
                  ? 'جارٍ الحفظ في Firestore...'
                  : 'حفظ الصلاحيات في Firestore'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
