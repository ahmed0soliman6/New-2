import React, { useState } from 'react';
import {
  ALL_SYSTEM_SCREENS,
  ALL_SPECIAL_PERMISSIONS,
  CustomPermissionsMap,
  SpecialPermissionsMap,
  getDefaultRolePermissions,
  getDefaultSpecialPermissions,
  normalizeRole,
  Role,
  ROLE_LABELS,
  ScreenAction,
  ScreenPermissionSet,
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
    specialPermissions?: SpecialPermissionsMap;
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
  const [activeTab, setActiveTab] = useState<'screens' | 'special'>('screens');

  // Initialize screen permissions state (Role acts only as default template)
  const [permissions, setPermissions] = useState<CustomPermissionsMap>(() => {
    const defaultRolePerms = getDefaultRolePermissions(normRole);

    if (user.customPermissions && typeof user.customPermissions === 'object') {
      const perms: CustomPermissionsMap = {};
      for (const screen of ALL_SYSTEM_SCREENS) {
        perms[screen.id] = user.customPermissions[screen.id] || defaultRolePerms[screen.id] || {
          view: false,
          create: false,
          update: false,
          delete: false,
        };
      }
      return perms;
    }

    if (user.allowedScreens && Array.isArray(user.allowedScreens)) {
      const perms: CustomPermissionsMap = {};
      for (const screen of ALL_SYSTEM_SCREENS) {
        const isAllowed = user.allowedScreens.includes(screen.id);
        perms[screen.id] = isAllowed
          ? defaultRolePerms[screen.id] || { view: true, create: true, update: true, delete: false }
          : { view: false, create: false, update: false, delete: false };
      }
      return perms;
    }

    return defaultRolePerms;
  });

  // Initialize fine-grained special permissions state
  const [specialPermissions, setSpecialPermissions] = useState<SpecialPermissionsMap>(() => {
    const defaults = getDefaultSpecialPermissions(normRole);
    if (user.specialPermissions && typeof user.specialPermissions === 'object') {
      return {
        ...defaults,
        ...user.specialPermissions,
      };
    }
    return defaults;
  });

  const [saving, setSaving] = useState(false);

  const handleActionToggle = (screenId: string, action: ScreenAction) => {
    setPermissions((prev) => {
      const current = prev[screenId] || { view: false, create: false, update: false, delete: false };
      const nextValue = !current[action];
      const updated: ScreenPermissionSet = {
        ...current,
        [action]: nextValue,
      };
      if (nextValue && action !== 'view') {
        updated.view = true;
      }
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

  const handleToggleSpecialPermission = (permId: string) => {
    setSpecialPermissions((prev) => ({
      ...prev,
      [permId]: !prev[permId],
    }));
  };

  const handleSelectAllGlobal = () => {
    const full: CustomPermissionsMap = {};
    for (const screen of ALL_SYSTEM_SCREENS) {
      full[screen.id] = { view: true, create: true, update: true, delete: true };
    }
    setPermissions(full);
    const fullSpecial: SpecialPermissionsMap = {};
    for (const sp of ALL_SPECIAL_PERMISSIONS) {
      fullSpecial[sp.id] = true;
    }
    setSpecialPermissions(fullSpecial);
  };

  const handleClearAllGlobal = () => {
    const empty: CustomPermissionsMap = {};
    for (const screen of ALL_SYSTEM_SCREENS) {
      empty[screen.id] = { view: false, create: false, update: false, delete: false };
    }
    setPermissions(empty);
    const emptySpecial: SpecialPermissionsMap = {};
    for (const sp of ALL_SPECIAL_PERMISSIONS) {
      emptySpecial[sp.id] = false;
    }
    setSpecialPermissions(emptySpecial);
  };

  const handleApplyPreset = (presetRole: Role) => {
    setPermissions(getDefaultRolePermissions(presetRole));
    setSpecialPermissions(getDefaultSpecialPermissions(presetRole));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allowedScreens = Object.keys(permissions).filter(
        (screenId) => permissions[screenId]?.view
      );

      // Sync overlapping specialPermissions with screen permissions when saved
      const syncedSpecial: SpecialPermissionsMap = {
        ...specialPermissions,
      };

      await updateManagedUser(user.uid, {
        customPermissions: permissions,
        allowedScreens,
        specialPermissions: syncedSpecial,
      });

      onSaved(
        `تم حفظ الصلاحيات المخصصة للمستخدم "${user.displayName || user.username}" في قاعدة البيانات بنجاح.`
      );
      onClose();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'تعذر حفظ الصلاحيات في قاعدة البيانات.');
    } finally {
      setSaving(false);
    }
  };

  const activeScreensCount = ALL_SYSTEM_SCREENS.filter((s) => permissions[s.id]?.view).length;
  const activeSpecialCount = ALL_SPECIAL_PERMISSIONS.filter((sp) => specialPermissions[sp.id]).length;

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
              <h3 className="text-base font-bold text-slate-900 dark:text-[#dde2f5] flex items-center gap-2 flex-wrap">
                <span>تخصيص الصلاحيات المرنة للمستخدم (مستقلة عن المسمى الوظيفي)</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#00c2cb]/20 text-[#008f97] dark:text-[#45dee7] font-bold">
                  {activeScreensCount} من {ALL_SYSTEM_SCREENS.length} شاشة • {activeSpecialCount} صلاحية خاصة
                </span>
              </h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-[#859394]">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  {user.displayName || user.username}
                </span>
                <span dir="ltr">(@{user.username})</span>
                <span>•</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-white/10">
                  قالب افتراضي: {ROLE_LABELS[normRole] || normRole}
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

        {/* Global Presets & Tabs Bar */}
        <div className="p-4 bg-slate-100/80 dark:bg-[#161f33] border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('screens')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'screens'
                  ? 'bg-[#00c2cb] text-slate-950 shadow-xs'
                  : 'bg-white dark:bg-[#111A2E] text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-white/15'
              }`}
            >
              صلاحيات الشاشات ({activeScreensCount}/{ALL_SYSTEM_SCREENS.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('special')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'special'
                  ? 'bg-[#00c2cb] text-slate-950 shadow-xs'
                  : 'bg-white dark:bg-[#111A2E] text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-white/15'
              }`}
            >
              الصلاحيات الدقيقة والخاصة ({activeSpecialCount}/{ALL_SPECIAL_PERMISSIONS.length})
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">قوالب سريعة:</span>
            <button
              type="button"
              onClick={handleSelectAllGlobal}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111A2E] border border-slate-300 dark:border-white/15 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:border-emerald-500 transition-colors cursor-pointer"
            >
              تحديد الكل
            </button>
            <button
              type="button"
              onClick={handleClearAllGlobal}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#111A2E] border border-slate-300 dark:border-white/15 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              إلغاء الكل
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('admin')}
              className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/30 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-colors cursor-pointer"
            >
              قالب مدير
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('doctor')}
              className="px-2.5 py-1 rounded-lg bg-[#00c2cb]/10 border border-[#00c2cb]/30 text-xs font-bold text-[#008f97] dark:text-[#45dee7] hover:bg-[#00c2cb]/20 transition-colors cursor-pointer"
            >
              قالب طبيب
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('secretary')}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
            >
              قالب سكرتير
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'screens' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {ALL_SYSTEM_SCREENS.map((screen) => {
                const perm = permissions[screen.id] || {
                  view: false,
                  create: false,
                  update: false,
                  delete: false,
                };

                const isAllSelected = perm.view && perm.create && perm.update && perm.delete;
                const hasSome = perm.view || perm.create || perm.update || perm.delete;

                return (
                  <div
                    key={screen.id}
                    className={`p-4 rounded-xl border transition-all ${
                      perm.view
                        ? 'border-[#00c2cb]/50 bg-[#00c2cb]/5 dark:bg-[#00c2cb]/10 shadow-xs'
                        : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02]'
                    }`}
                  >
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
                          onClick={() => handleToggleAllForScreen(screen.id)}
                          className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
                            isAllSelected
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                              : hasSome
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30'
                              : 'bg-slate-200 dark:bg-white/10 text-slate-500 border-slate-300 dark:border-white/15'
                          }`}
                        >
                          {isAllSelected ? 'الكل مفعل ✓' : hasSome ? 'مخصص' : 'محجوبة ✕'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <label
                        className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs select-none transition-all cursor-pointer ${
                          perm.view
                            ? 'bg-blue-500/10 border-blue-500/40 text-blue-700 dark:text-blue-300 font-bold'
                            : 'bg-white dark:bg-[#111A2E] border-slate-200 dark:border-white/10 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={perm.view}
                          disabled={saving}
                          onChange={() => handleActionToggle(screen.id, 'view')}
                          className="rounded accent-blue-600"
                        />
                        <span>عرض</span>
                      </label>

                      <label
                        className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs select-none transition-all cursor-pointer ${
                          perm.create
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'bg-white dark:bg-[#111A2E] border-slate-200 dark:border-white/10 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={perm.create}
                          disabled={saving}
                          onChange={() => handleActionToggle(screen.id, 'create')}
                          className="rounded accent-emerald-600"
                        />
                        <span>إضافة</span>
                      </label>

                      <label
                        className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs select-none transition-all cursor-pointer ${
                          perm.update
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold'
                            : 'bg-white dark:bg-[#111A2E] border-slate-200 dark:border-white/10 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={perm.update}
                          disabled={saving}
                          onChange={() => handleActionToggle(screen.id, 'update')}
                          className="rounded accent-amber-600"
                        />
                        <span>تعديل</span>
                      </label>

                      <label
                        className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs select-none transition-all cursor-pointer ${
                          perm.delete
                            ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-300 font-bold'
                            : 'bg-white dark:bg-[#111A2E] border-slate-200 dark:border-white/10 text-slate-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={perm.delete}
                          disabled={saving}
                          onChange={() => handleActionToggle(screen.id, 'delete')}
                          className="rounded accent-rose-600"
                        />
                        <span>حذف</span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-[#00c2cb]/10 border border-[#00c2cb]/30 text-xs text-slate-700 dark:text-slate-200">
                تتيح هذه القائمة منح أو سحب الصلاحيات الإكلينيكية والمالية والإدارية الحساسة بشكل مستقل تمامًا عن المسمى الوظيفي (مثل منح السكرتير صلاحية فتح كشف أو حذف مريض أو منع الطبيب من حذف مريض).
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ALL_SPECIAL_PERMISSIONS.map((sp) => {
                  const enabled = Boolean(specialPermissions[sp.id]);
                  return (
                    <label
                      key={sp.id}
                      className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                        enabled
                          ? 'border-[#00c2cb]/50 bg-[#00c2cb]/10 text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] text-slate-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={saving}
                        onChange={() => handleToggleSpecialPermission(sp.id)}
                        className="mt-1 rounded accent-[#00c2cb]"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs">{sp.title}</span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300" dir="ltr">
                            {sp.id}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-[#859394] mt-1">
                          {sp.description}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1322] flex items-center justify-between">
          <div className="text-xs text-slate-600 dark:text-[#859394]">
            <span>الشاشات المفعلة: </span>
            <strong className="text-[#008f97] dark:text-[#45dee7] font-bold">
              {activeScreensCount} شاشة
            </strong>
            <span className="mx-2">•</span>
            <span>الصلاحيات الخاصة: </span>
            <strong className="text-[#008f97] dark:text-[#45dee7] font-bold">
              {activeSpecialCount} صلاحية
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
              disabled={saving}
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md bg-[#00c2cb] hover:bg-[#45dee7] text-slate-950 cursor-pointer shadow-[#00c2cb]/20 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">
                {saving ? 'sync' : 'save'}
              </span>
              <span>
                {saving ? 'جارٍ الحفظ في قاعدة البيانات...' : 'حفظ الصلاحيات المخصصة'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
