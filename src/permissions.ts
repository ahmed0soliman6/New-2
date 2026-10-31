/**
 * SOLI MEDICAL — CENTRAL PERMISSION MATRIX & RBAC
 * Single source of truth for Roles, Permissions, and Access Control.
 */

export type Role = 'admin' | 'doctor' | 'secretary';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'مدير',
  doctor: 'طبيب',
  secretary: 'سكرتير',
};

export type ScreenAction = 'view' | 'create' | 'update' | 'delete';

export interface ScreenPermissionSet {
  view: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
}

export type CustomPermissionsMap = Record<string, ScreenPermissionSet>;

export type Permission =
  // Dashboard
  | 'dashboard.view'
  // Patients
  | 'patients.view'
  | 'patients.create'
  | 'patients.edit'
  | 'patients.delete'
  // Visits
  | 'visits.create'
  | 'visits.view'
  | 'visits.edit'
  | 'visits.delete'
  // Queue
  | 'queue.view'
  | 'queue.manage'
  // Clinical Examination
  | 'clinical.view'
  | 'clinical.edit'
  | 'clinical.complete'
  // Prescriptions
  | 'prescription.view'
  | 'prescription.create'
  | 'prescription.print'
  // Appointments & Follow-ups
  | 'appointments.view'
  | 'appointments.create'
  | 'appointments.edit'
  | 'appointments.delete'
  | 'appointments.checkin'
  // Billing & Finance
  | 'billing.view'
  | 'billing.create'
  | 'billing.edit'
  | 'billing.delete'
  | 'billing.expenses'
  | 'billing.closeShift'
  // Reports & Analytics
  | 'reports.view'
  | 'reports.financial'
  | 'reports.clinical'
  // Settings
  | 'settings.view'
  | 'settings.edit'
  // Users & Roles Management
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.disable'
  | 'users.delete'
  | 'roles.manage';

/**
 * ALL_PERMISSIONS list for Admin super-user.
 */
export const ALL_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'patients.view',
  'patients.create',
  'patients.edit',
  'patients.delete',
  'visits.create',
  'visits.view',
  'visits.edit',
  'visits.delete',
  'queue.view',
  'queue.manage',
  'clinical.view',
  'clinical.edit',
  'clinical.complete',
  'prescription.view',
  'prescription.create',
  'prescription.print',
  'appointments.view',
  'appointments.create',
  'appointments.edit',
  'appointments.delete',
  'appointments.checkin',
  'billing.view',
  'billing.create',
  'billing.edit',
  'billing.delete',
  'billing.expenses',
  'billing.closeShift',
  'reports.view',
  'reports.financial',
  'reports.clinical',
  'settings.view',
  'settings.edit',
  'users.view',
  'users.create',
  'users.edit',
  'users.disable',
  'users.delete',
  'roles.manage',
];

/**
 * Centrally defined Role -> Permissions Matrix
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // ADMIN: Full access to all screens, actions, settings, and user management.
  admin: ALL_PERMISSIONS,

  // DOCTOR: Clinical exam, prescriptions, patient files, appointments, queue, medical reports.
  doctor: [
    'dashboard.view',
    'patients.view',
    'patients.create',
    'patients.edit',
    'visits.view',
    'visits.edit',
    'queue.view',
    'queue.manage',
    'clinical.view',
    'clinical.edit',
    'clinical.complete',
    'prescription.view',
    'prescription.create',
    'prescription.print',
    'appointments.view',
    'appointments.create',
    'appointments.edit',
    'appointments.delete',
    'appointments.checkin',
    'billing.view',
    'reports.view',
    'reports.clinical',
    'settings.view',
    'settings.edit',
  ],

  // SECRETARY: New visit registration, queue management, appointments, patient files, billing/payments/expenses, printing receipts.
  secretary: [
    'dashboard.view',
    'patients.view',
    'patients.create',
    'patients.edit',
    'visits.create',
    'visits.view',
    'visits.edit',
    'queue.view',
    'queue.manage',
    'appointments.view',
    'appointments.create',
    'appointments.edit',
    'appointments.delete',
    'appointments.checkin',
    'billing.view',
    'billing.create',
    'billing.edit',
    'billing.expenses',
    'billing.closeShift',
    'prescription.print',
    'reports.view',
  ],
};

/**
 * Detailed specification of every system screen/page for admin customization.
 */
export interface SystemScreenDef {
  id: string;
  title: string;
  category: 'clinical' | 'reception' | 'finance' | 'admin';
  categoryLabel: string;
  icon: string;
  description: string;
  availableActions: ScreenAction[];
}

export const ALL_SYSTEM_SCREENS: SystemScreenDef[] = [
  {
    id: 'dashboard',
    title: 'لوحة التحكم المركزية',
    category: 'reception',
    categoryLabel: 'استقبال وعام',
    icon: 'space_dashboard',
    description: 'المؤشرات العامة، إحصائيات اليوم، قائمة الانتظار، واستدعاء المرضى.',
    availableActions: ['view'],
  },
  {
    id: 'new-visit',
    title: 'تسجيل زيارة جديدة',
    category: 'reception',
    categoryLabel: 'استقبال وعام',
    icon: 'person_add',
    description: 'فتح تذكرة كشف، تسجيل بيانات المريض، وتوجيهه إلى طابور الانتظار.',
    availableActions: ['view', 'create', 'update', 'delete'],
  },
  {
    id: 'waiting-queue',
    title: 'صالة الانتظار وطابور المرضى',
    category: 'reception',
    categoryLabel: 'استقبال وعام',
    icon: 'hourglass_top',
    description: 'إدارة طابور الحضور، ترتيب الأدوار، والنداء الصوتي للشاشة.',
    availableActions: ['view', 'create', 'update', 'delete'],
  },
  {
    id: 'upcoming-followups',
    title: 'المتابعة القادمة والمواعيد',
    category: 'reception',
    categoryLabel: 'استقبال وعام',
    icon: 'event_repeat',
    description: 'جدول المواعيد المستقبلية، حجز الاستشارات، وتأكيد الحضور.',
    availableActions: ['view', 'create', 'update', 'delete'],
  },
  {
    id: 'clinical-exam',
    title: 'الكشف الطبي للغرفة والروشتة',
    category: 'clinical',
    categoryLabel: 'عيادة وإكلينيكي',
    icon: 'stethoscope',
    description: 'فحص المريض، كتابة التشخيص، تسجيل القياسات الحيوية، صرف الأدوية، وإنهاء الكشف.',
    availableActions: ['view', 'create', 'update', 'delete'],
  },
  {
    id: 'patient-records',
    title: 'ملفات المرضى (EMR)',
    category: 'clinical',
    categoryLabel: 'عيادة وإكلينيكي',
    icon: 'folder_shared',
    description: 'الأرشيف والسجل الطبي، التاريخ المرضي، والزيارات والروشتات السابقة.',
    availableActions: ['view', 'create', 'update', 'delete'],
  },
  {
    id: 'prescription-pad',
    title: 'إعدادات الروشتة والطباعة',
    category: 'clinical',
    categoryLabel: 'عيادة وإكلينيكي',
    icon: 'print',
    description: 'التحكم في رأس وتذييل الروشتة، الشعار، QR Code، الهوامش، والمعاينة المباشرة.',
    availableActions: ['view', 'create', 'update', 'delete'],
  },
  {
    id: 'billing-payments',
    title: 'الفواتير والمدفوعات والخزينة',
    category: 'finance',
    categoryLabel: 'ماليات وخزينة',
    icon: 'receipt_long',
    description: 'تحصيل رسوم الكشوفات، سندات القبض، تسجيل المصروفات، وتقفيل الوردية اليومية.',
    availableActions: ['view', 'create', 'update', 'delete'],
  },
  {
    id: 'clinical-reports',
    title: 'التقارير والإحصائيات',
    category: 'finance',
    categoryLabel: 'ماليات وخزينة',
    icon: 'analytics',
    description: 'تقارير الإيرادات، صافي الخزينة، تحليلات المرضى ومعدلات التردد.',
    availableActions: ['view'],
  },
  {
    id: 'system-settings',
    title: 'إعدادات النظام وإدارة الحسابات',
    category: 'admin',
    categoryLabel: 'إدارة وتحكم',
    icon: 'settings',
    description: 'إدارة المستخدمين، التحكم بصلاحيات الصفحات، أسعار الكشوفات، وأدلة النظام.',
    availableActions: ['view', 'create', 'update', 'delete'],
  },
  {
    id: 'booking-landing',
    title: 'صفحة هبوط حجز المواعيد',
    category: 'reception',
    categoryLabel: 'حجز أونلاين',
    icon: 'event_available',
    description: 'صفحة الحجز المباشر بالعيادة والمخصصة للمرضى والواتساب.',
    availableActions: ['view', 'create'],
  },
];

/**
 * Screen ID aliases mapping for seamless compatibility across routes.
 */
const SCREEN_ALIASES: Record<string, string[]> = {
  dashboard: ['dashboard'],
  'new-visit': ['new-visit'],
  'waiting-queue': ['waiting-queue'],
  'clinical-exam': ['clinical-exam'],
  'upcoming-followups': ['upcoming-followups', 'appointments'],
  appointments: ['upcoming-followups', 'appointments'],
  'patient-records': ['patient-records', 'patient-files'],
  'billing-payments': ['billing-payments', 'finance'],
  finance: ['billing-payments', 'finance'],
  'clinical-reports': ['clinical-reports', 'analytics'],
  'booking-landing': ['booking-landing'],
  'prescriptions-catalog': ['prescriptions-catalog'],
  'prescription-pad': ['prescription-pad'],
  'system-settings': ['system-settings', 'settings'],
  settings: ['system-settings', 'settings'],
};

/**
 * Normalizes any string or Firestore representation to 'admin' | 'doctor' | 'secretary'.
 */
export function normalizeRole(rawRole: unknown): Role {
  if (!rawRole) return 'secretary';
  const str = String(rawRole).toLowerCase().trim();
  if (str === 'admin') return 'admin';
  if (str === 'doctor') return 'doctor';
  if (str === 'secretary') return 'secretary';
  return 'secretary';
}

/**
 * Returns default granular permissions per screen for a given role.
 */
export function getDefaultRolePermissions(role: Role | string | undefined | null): CustomPermissionsMap {
  const norm = normalizeRole(role);
  const result: CustomPermissionsMap = {};

  for (const screen of ALL_SYSTEM_SCREENS) {
    if (screen.id === 'booking-landing') {
      result[screen.id] = { view: true, create: true, update: true, delete: false };
      continue;
    }
    if (norm === 'admin') {
      result[screen.id] = { view: true, create: true, update: true, delete: true };
    } else if (norm === 'doctor') {
      if (['dashboard', 'clinical-reports'].includes(screen.id)) {
        result[screen.id] = { view: true, create: false, update: false, delete: false };
      } else if (['waiting-queue'].includes(screen.id)) {
        result[screen.id] = { view: true, create: false, update: true, delete: false };
      } else if (['clinical-exam', 'upcoming-followups'].includes(screen.id)) {
        result[screen.id] = { view: true, create: true, update: true, delete: true };
      } else if (['new-visit', 'patient-records', 'prescription-pad'].includes(screen.id)) {
        result[screen.id] = { view: true, create: true, update: true, delete: false };
      } else if (['billing-payments', 'system-settings'].includes(screen.id)) {
        result[screen.id] = { view: true, create: false, update: false, delete: false };
      } else {
        result[screen.id] = { view: false, create: false, update: false, delete: false };
      }
    } else {
      // Secretary defaults
      if (['dashboard', 'clinical-reports'].includes(screen.id)) {
        result[screen.id] = { view: true, create: false, update: false, delete: false };
      } else if (['new-visit', 'waiting-queue', 'upcoming-followups', 'patient-records', 'billing-payments'].includes(screen.id)) {
        result[screen.id] = { view: true, create: true, update: true, delete: screen.id === 'upcoming-followups' };
      } else {
        result[screen.id] = { view: false, create: false, update: false, delete: false };
      }
    }
  }

  return result;
}

/**
 * Returns default screens for a given role if no custom allowedScreens were specified.
 */
export function getDefaultAllowedScreens(role: Role | string | undefined | null): string[] {
  const defaultPerms = getDefaultRolePermissions(role);
  return Object.keys(defaultPerms).filter((screenId) => defaultPerms[screenId]?.view);
}

/**
 * Checks whether a user has permission to perform an action on a specific screen.
 */
export function checkScreenPermission(
  role: Role | string | undefined | null,
  screenId: string,
  action: ScreenAction,
  customPermissions?: CustomPermissionsMap | null,
  allowedScreens?: string[] | null
): boolean {
  const normRole = normalizeRole(role);

  // Admin super-user has full access to everything
  if (normRole === 'admin') {
    return true;
  }

  // Resolve aliases (e.g., 'finance' -> 'billing-payments', 'settings' -> 'system-settings')
  const canonicalScreenId =
    ALL_SYSTEM_SCREENS.find((s) => (SCREEN_ALIASES[s.id] || [s.id]).includes(screenId))?.id || screenId;

  // 1. Check custom permissions matrix if explicitly set for this user
  if (customPermissions && typeof customPermissions === 'object') {
    const userPerm = customPermissions[canonicalScreenId];
    if (userPerm) {
      return Boolean(userPerm[action]);
    }
  }

  // 2. Fallback to allowedScreens array if only screens list was stored (backward compatibility)
  if (action === 'view' && allowedScreens && Array.isArray(allowedScreens) && allowedScreens.length > 0) {
    const aliases = SCREEN_ALIASES[canonicalScreenId] || [canonicalScreenId];
    return aliases.some((a) => allowedScreens.includes(a));
  }

  // 3. Fallback to role-based default permissions
  const defaultRolePerms = getDefaultRolePermissions(normRole);
  const screenPerm = defaultRolePerms[canonicalScreenId];
  return screenPerm ? Boolean(screenPerm[action]) : false;
}

/**
 * Checks whether a given role holds a specific permission (legacy string check).
 */
export function hasPermission(
  role: Role | string | undefined | null,
  permission: Permission,
  customPermissions?: CustomPermissionsMap | null,
  allowedScreens?: string[] | null
): boolean {
  const normRole = normalizeRole(role);
  if (normRole === 'admin') return true;

  // Map legacy permission keys to screen actions
  const permMapping: Record<string, { screenId: string; action: ScreenAction }> = {
    'dashboard.view': { screenId: 'dashboard', action: 'view' },
    'patients.view': { screenId: 'patient-records', action: 'view' },
    'patients.create': { screenId: 'patient-records', action: 'create' },
    'patients.edit': { screenId: 'patient-records', action: 'update' },
    'patients.delete': { screenId: 'patient-records', action: 'delete' },
    'visits.create': { screenId: 'new-visit', action: 'create' },
    'visits.view': { screenId: 'new-visit', action: 'view' },
    'visits.edit': { screenId: 'new-visit', action: 'update' },
    'visits.delete': { screenId: 'new-visit', action: 'delete' },
    'queue.view': { screenId: 'waiting-queue', action: 'view' },
    'queue.manage': { screenId: 'waiting-queue', action: 'update' },
    'clinical.view': { screenId: 'clinical-exam', action: 'view' },
    'clinical.edit': { screenId: 'clinical-exam', action: 'update' },
    'clinical.complete': { screenId: 'clinical-exam', action: 'update' },
    'prescription.view': { screenId: 'prescription-pad', action: 'view' },
    'prescription.create': { screenId: 'prescription-pad', action: 'create' },
    'prescription.print': { screenId: 'prescription-pad', action: 'view' },
    'appointments.view': { screenId: 'upcoming-followups', action: 'view' },
    'appointments.create': { screenId: 'upcoming-followups', action: 'create' },
    'appointments.edit': { screenId: 'upcoming-followups', action: 'update' },
    'appointments.delete': { screenId: 'upcoming-followups', action: 'delete' },
    'appointments.checkin': { screenId: 'upcoming-followups', action: 'update' },
    'billing.view': { screenId: 'billing-payments', action: 'view' },
    'billing.create': { screenId: 'billing-payments', action: 'create' },
    'billing.edit': { screenId: 'billing-payments', action: 'update' },
    'billing.delete': { screenId: 'billing-payments', action: 'delete' },
    'billing.expenses': { screenId: 'billing-payments', action: 'create' },
    'billing.closeShift': { screenId: 'billing-payments', action: 'update' },
    'reports.view': { screenId: 'clinical-reports', action: 'view' },
    'reports.financial': { screenId: 'clinical-reports', action: 'view' },
    'reports.clinical': { screenId: 'clinical-reports', action: 'view' },
    'settings.view': { screenId: 'system-settings', action: 'view' },
    'settings.edit': { screenId: 'system-settings', action: 'update' },
    'users.view': { screenId: 'system-settings', action: 'view' },
    'users.create': { screenId: 'system-settings', action: 'create' },
    'users.edit': { screenId: 'system-settings', action: 'update' },
    'users.disable': { screenId: 'system-settings', action: 'update' },
    'users.delete': { screenId: 'system-settings', action: 'delete' },
    'roles.manage': { screenId: 'system-settings', action: 'update' },
  };

  const target = permMapping[permission];
  if (target) {
    return checkScreenPermission(normRole, target.screenId, target.action, customPermissions, allowedScreens);
  }

  const permissions = ROLE_PERMISSIONS[normRole];
  return permissions ? permissions.includes(permission) : false;
}

/**
 * Checks whether a screen is in the allowedScreens list, respecting aliases.
 */
export function isScreenAllowed(
  screenId: string,
  allowedScreens?: string[] | null
): boolean {
  if (!allowedScreens || !Array.isArray(allowedScreens) || allowedScreens.length === 0) {
    return false;
  }
  const aliases = SCREEN_ALIASES[screenId] || [screenId];
  return aliases.some((alias) => allowedScreens.includes(alias));
}

/**
 * Checks whether a role can navigate to a specific screen/route.
 */
export function canAccessRoute(
  role: Role | string | undefined | null,
  screenId: string,
  userAllowedScreens?: string[] | null,
  customPermissions?: CustomPermissionsMap | null
): boolean {
  return checkScreenPermission(role, screenId, 'view', customPermissions, userAllowedScreens);
}

/**
 * Asserts that the role has the permission, otherwise throws an error.
 */
export function assertPermission(
  role: Role | string | undefined | null,
  permission: Permission,
  actionDescription?: string,
  customPermissions?: CustomPermissionsMap | null
): void {
  if (!hasPermission(role, permission, customPermissions)) {
    const norm = normalizeRole(role);
    const label = ROLE_LABELS[norm];
    const desc = actionDescription ? ` (${actionDescription})` : '';
    throw new Error(
      `غير مصرح: دورك الحالي (${label}) لا يملك صلاحية تنفيذ هذا الإجراء${desc} [${permission}].`
    );
  }
}

/**
 * Returns all permissions granted to a given role.
 */
export function getRolePermissions(role: Role | string | undefined | null): readonly Permission[] {
  const norm = normalizeRole(role);
  return ROLE_PERMISSIONS[norm] || [];
}

