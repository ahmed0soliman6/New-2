/**
 * SOLI MEDICAL — CENTRAL PERMISSION MATRIX & CUSTOM RBAC/ABAC ENGINE (v3.0.0)
 * Single source of truth for Roles, Custom Screen Permissions, and Special Operational Permissions.
 * Role ('admin' | 'doctor' | 'secretary') is used ONLY as an initial default template;
 * explicit customPermissions and specialPermissions granted by the manager take full precedence.
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
  | 'patients.update'
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
  | 'clinical.open'
  | 'clinical.edit'
  | 'clinical.complete'
  // Prescriptions
  | 'prescription.view'
  | 'prescription.create'
  | 'prescription.edit'
  | 'prescription.delete'
  | 'prescription.print'
  // Lab & Radiology
  | 'lab.view'
  | 'lab.create'
  | 'lab.update'
  | 'lab.delete'
  | 'radiology.view'
  | 'radiology.create'
  | 'radiology.update'
  | 'radiology.delete'
  // Appointments & Follow-ups
  | 'appointments.view'
  | 'appointments.create'
  | 'appointments.edit'
  | 'appointments.delete'
  | 'appointments.checkin'
  // Billing, Invoices & Payments
  | 'billing.view'
  | 'billing.create'
  | 'billing.edit'
  | 'billing.delete'
  | 'billing.expenses'
  | 'billing.closeShift'
  | 'payments.view'
  | 'payments.create'
  | 'payments.edit'
  | 'payments.delete'
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
  | 'users.manage'
  | 'roles.manage'
  // Special High-Sensitivity Operations
  | 'system.clear_all_data'
  | 'backup.export'
  | 'backup.restore'
  | 'demo.manage';

export type SpecialPermissionsMap = Partial<Record<Permission, boolean>>;

export interface SpecialPermissionDef {
  id: Permission;
  title: string;
  description: string;
  category: 'patients' | 'clinical' | 'finance' | 'system';
  icon: string;
  danger?: boolean;
}

export const ALL_SPECIAL_PERMISSIONS: SpecialPermissionDef[] = [
  {
    id: 'patients.update',
    title: 'تعديل بيانات المرضى (patients.update)',
    description: 'السماح بتحديث البيانات الأساسية والطبية في ملف المريض.',
    category: 'patients',
    icon: 'edit_note',
  },
  {
    id: 'patients.delete',
    title: 'حذف مريض مفرد (patients.delete)',
    description: 'السماح بحذف ملف مريض واحد من سجلات العيادة (منفصل عن الحذف الجماعي).',
    category: 'patients',
    icon: 'person_remove',
    danger: true,
  },
  {
    id: 'clinical.open',
    title: 'فتح كشف طبي (clinical.open)',
    description: 'السماح بفتح شاشة الكشف الطبي وبدء جلسة فحص للمريض.',
    category: 'clinical',
    icon: 'medical_services',
  },
  {
    id: 'clinical.complete',
    title: 'اعتماد وإنهاء الكشف والروشتة (clinical.complete)',
    description: 'حفظ التشخيص والروشتة وطلبات التحاليل والأشعة وإنهاء الزيارة.',
    category: 'clinical',
    icon: 'task_alt',
  },
  {
    id: 'billing.delete',
    title: 'حذف الفواتير والمدفوعات المالية (billing.delete)',
    description: 'حذف السجلات المالية والمدفوعات (منفصل عن صلاحية حذف الملف الطبي).',
    category: 'finance',
    icon: 'delete_sweep',
    danger: true,
  },
  {
    id: 'backup.export',
    title: 'تصدير نسخة احتياطية (backup.export)',
    description: 'تحميل نسخة احتياطية موثقة (JSON + Manifest + Checksum) لبيانات العيادة.',
    category: 'system',
    icon: 'download',
  },
  {
    id: 'backup.restore',
    title: 'استعادة من نسخة احتياطية (backup.restore)',
    description: 'استيراد واسترجاع بيانات العيادة من ملف نسخة احتياطية (منفصل عن التصدير).',
    category: 'system',
    icon: 'settings_backup_restore',
    danger: true,
  },
  {
    id: 'system.clear_all_data',
    title: 'الحذف الجماعي السحابي لبيانات العيادة (system.clear_all_data)',
    description: 'مسح جميع سجلات المرضى والزيارات والفواتير من السحابة مع بقاء الإعدادات والكتالوجات.',
    category: 'system',
    icon: 'delete_forever',
    danger: true,
  },
  {
    id: 'demo.manage',
    title: 'إدارة وتوليد البيانات التجريبية (demo.manage)',
    description: 'توليد أو مسح البيانات التجريبية المعزولة بعلامة isDemo.',
    category: 'system',
    icon: 'science',
  },
  {
    id: 'users.manage',
    title: 'إدارة المستخدمين والصلاحيات (users.manage)',
    description: 'إنشاء وتعديل وحذف حسابات المستخدمين وتخصيص صلاحياتهم.',
    category: 'system',
    icon: 'manage_accounts',
    danger: true,
  },
];

/**
 * ALL_PERMISSIONS list for full access template.
 */
export const ALL_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'patients.view',
  'patients.create',
  'patients.update',
  'patients.edit',
  'patients.delete',
  'visits.create',
  'visits.view',
  'visits.edit',
  'visits.delete',
  'queue.view',
  'queue.manage',
  'clinical.view',
  'clinical.open',
  'clinical.edit',
  'clinical.complete',
  'prescription.view',
  'prescription.create',
  'prescription.edit',
  'prescription.delete',
  'prescription.print',
  'lab.view',
  'lab.create',
  'lab.update',
  'lab.delete',
  'radiology.view',
  'radiology.create',
  'radiology.update',
  'radiology.delete',
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
  'payments.view',
  'payments.create',
  'payments.edit',
  'payments.delete',
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
  'users.manage',
  'roles.manage',
  'system.clear_all_data',
  'backup.export',
  'backup.restore',
  'demo.manage',
];

/**
 * Default Role -> Permissions Matrix (Used ONLY when not overridden by customPermissions / specialPermissions)
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: ALL_PERMISSIONS,

  doctor: [
    'dashboard.view',
    'patients.view',
    'patients.create',
    'patients.update',
    'patients.edit',
    'visits.view',
    'visits.edit',
    'queue.view',
    'queue.manage',
    'clinical.view',
    'clinical.open',
    'clinical.edit',
    'clinical.complete',
    'prescription.view',
    'prescription.create',
    'prescription.edit',
    'prescription.delete',
    'prescription.print',
    'lab.view',
    'lab.create',
    'lab.update',
    'lab.delete',
    'radiology.view',
    'radiology.create',
    'radiology.update',
    'radiology.delete',
    'appointments.view',
    'appointments.create',
    'appointments.edit',
    'appointments.delete',
    'appointments.checkin',
    'billing.view',
    'payments.view',
    'reports.view',
    'reports.clinical',
    'settings.view',
    'settings.edit',
    'backup.export',
  ],

  secretary: [
    'dashboard.view',
    'patients.view',
    'patients.create',
    'patients.update',
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
    'payments.view',
    'payments.create',
    'payments.edit',
    'prescription.print',
    'reports.view',
  ],
};

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

export function normalizeRole(rawRole: unknown): Role {
  if (!rawRole) return 'secretary';
  const str = String(rawRole).toLowerCase().trim();
  if (str === 'admin') return 'admin';
  if (str === 'doctor') return 'doctor';
  if (str === 'secretary') return 'secretary';
  return 'secretary';
}

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
      } else if (
        ['new-visit', 'waiting-queue', 'upcoming-followups', 'patient-records', 'billing-payments'].includes(
          screen.id
        )
      ) {
        result[screen.id] = {
          view: true,
          create: true,
          update: true,
          delete: screen.id === 'upcoming-followups',
        };
      } else {
        result[screen.id] = { view: false, create: false, update: false, delete: false };
      }
    }
  }

  return result;
}

export function getDefaultSpecialPermissions(role: Role | string | undefined | null): SpecialPermissionsMap {
  const norm = normalizeRole(role);
  if (norm === 'admin') {
    return {
      'patients.update': true,
      'patients.delete': true,
      'clinical.open': true,
      'clinical.complete': true,
      'billing.delete': true,
      'backup.export': true,
      'backup.restore': true,
      'system.clear_all_data': true,
      'demo.manage': true,
      'users.manage': true,
    };
  }
  if (norm === 'doctor') {
    return {
      'patients.update': true,
      'patients.delete': false,
      'clinical.open': true,
      'clinical.complete': true,
      'billing.delete': false,
      'backup.export': true,
      'backup.restore': false,
      'system.clear_all_data': false,
      'demo.manage': false,
      'users.manage': false,
    };
  }
  return {
    'patients.update': true,
    'patients.delete': false,
    'clinical.open': false,
    'clinical.complete': false,
    'billing.delete': false,
    'backup.export': false,
    'backup.restore': false,
    'system.clear_all_data': false,
    'demo.manage': false,
    'users.manage': false,
  };
}

export function getDefaultAllowedScreens(role: Role | string | undefined | null): string[] {
  const defaultPerms = getDefaultRolePermissions(role);
  return Object.keys(defaultPerms).filter((screenId) => defaultPerms[screenId]?.view);
}

/**
 * Checks whether a user has permission to perform an action on a specific screen.
 * Respects explicit customPermissions & specialPermissions regardless of the user's base role.
 */
export function checkScreenPermission(
  role: Role | string | undefined | null,
  screenId: string,
  action: ScreenAction,
  customPermissions?: CustomPermissionsMap | null,
  allowedScreens?: string[] | null,
  specialPermissions?: SpecialPermissionsMap | null
): boolean {
  const normRole = normalizeRole(role);

  const canonicalScreenId =
    ALL_SYSTEM_SCREENS.find((s) => (SCREEN_ALIASES[s.id] || [s.id]).includes(screenId))?.id || screenId;

  // 1. Check explicit specialPermissions overrides mapped to specific screen actions
  if (specialPermissions && typeof specialPermissions === 'object') {
    if (canonicalScreenId === 'patient-records' && action === 'delete') {
      if (typeof specialPermissions['patients.delete'] === 'boolean') {
        return specialPermissions['patients.delete'];
      }
    }
    if (canonicalScreenId === 'patient-records' && action === 'update') {
      if (typeof specialPermissions['patients.update'] === 'boolean') {
        return specialPermissions['patients.update'];
      }
      if (typeof specialPermissions['patients.edit'] === 'boolean') {
        return specialPermissions['patients.edit'];
      }
    }
    if (canonicalScreenId === 'billing-payments' && action === 'delete') {
      if (typeof specialPermissions['billing.delete'] === 'boolean') {
        return specialPermissions['billing.delete'];
      }
      if (typeof specialPermissions['payments.delete'] === 'boolean') {
        return specialPermissions['payments.delete'];
      }
    }
    if (canonicalScreenId === 'clinical-exam' && (action === 'view' || action === 'create')) {
      if (specialPermissions['clinical.open'] === true || specialPermissions['clinical.complete'] === true) {
        return true;
      }
    }
    if (canonicalScreenId === 'clinical-exam' && action === 'update') {
      if (typeof specialPermissions['clinical.complete'] === 'boolean') {
        return specialPermissions['clinical.complete'];
      }
      if (typeof specialPermissions['clinical.open'] === 'boolean') {
        return specialPermissions['clinical.open'];
      }
    }
  }

  // 2. Check customPermissions matrix if explicitly set for this user
  if (customPermissions && typeof customPermissions === 'object') {
    const userPerm = customPermissions[canonicalScreenId];
    if (userPerm && typeof userPerm[action] === 'boolean') {
      return Boolean(userPerm[action]);
    }
  }

  // 3. Fallback to allowedScreens array for view action
  if (action === 'view' && allowedScreens && Array.isArray(allowedScreens) && allowedScreens.length > 0) {
    const aliases = SCREEN_ALIASES[canonicalScreenId] || [canonicalScreenId];
    return aliases.some((a) => allowedScreens.includes(a));
  }

  // 4. Fallback to role-based default permissions
  if (normRole === 'admin') {
    return true;
  }
  const defaultRolePerms = getDefaultRolePermissions(normRole);
  const screenPerm = defaultRolePerms[canonicalScreenId];
  return screenPerm ? Boolean(screenPerm[action]) : false;
}

/**
 * Checks whether a user holds a specific granular permission.
 * Evaluates explicit specialPermissions & customPermissions BEFORE falling back to role defaults.
 */
export function hasPermission(
  role: Role | string | undefined | null,
  permission: Permission,
  customPermissions?: CustomPermissionsMap | null,
  allowedScreens?: string[] | null,
  specialPermissions?: SpecialPermissionsMap | null
): boolean {
  const normRole = normalizeRole(role);

  // 1. Check explicit specialPermissions map first (highest precedence for any role)
  if (specialPermissions && typeof specialPermissions === 'object') {
    if (typeof specialPermissions[permission] === 'boolean') {
      return Boolean(specialPermissions[permission]);
    }
    // Check aliases in specialPermissions
    if (permission === 'patients.edit' && typeof specialPermissions['patients.update'] === 'boolean') {
      return Boolean(specialPermissions['patients.update']);
    }
    if (permission === 'patients.update' && typeof specialPermissions['patients.edit'] === 'boolean') {
      return Boolean(specialPermissions['patients.edit']);
    }
    if (permission === 'payments.delete' && typeof specialPermissions['billing.delete'] === 'boolean') {
      return Boolean(specialPermissions['billing.delete']);
    }
    if (permission === 'billing.delete' && typeof specialPermissions['payments.delete'] === 'boolean') {
      return Boolean(specialPermissions['payments.delete']);
    }
    if (
      (permission === 'clinical.view' || permission === 'clinical.edit') &&
      (specialPermissions['clinical.open'] === true || specialPermissions['clinical.complete'] === true)
    ) {
      return true;
    }
    if (
      ['users.view', 'users.create', 'users.edit', 'users.disable', 'users.delete', 'roles.manage'].includes(
        permission
      ) &&
      typeof specialPermissions['users.manage'] === 'boolean'
    ) {
      return Boolean(specialPermissions['users.manage']);
    }
  }

  // 2. High-sensitivity standalone permissions require explicit specialPermissions for non-admin
  const standaloneSpecials: Permission[] = [
    'system.clear_all_data',
    'backup.restore',
    'demo.manage',
    'users.manage',
  ];
  if (standaloneSpecials.includes(permission)) {
    const defaults = getDefaultSpecialPermissions(normRole);
    return Boolean(defaults[permission]);
  }

  // 3. Map granular permissions to screen CRUD actions
  const permMapping: Record<string, { screenId: string; action: ScreenAction }> = {
    'dashboard.view': { screenId: 'dashboard', action: 'view' },
    'patients.view': { screenId: 'patient-records', action: 'view' },
    'patients.create': { screenId: 'patient-records', action: 'create' },
    'patients.update': { screenId: 'patient-records', action: 'update' },
    'patients.edit': { screenId: 'patient-records', action: 'update' },
    'patients.delete': { screenId: 'patient-records', action: 'delete' },
    'visits.create': { screenId: 'new-visit', action: 'create' },
    'visits.view': { screenId: 'new-visit', action: 'view' },
    'visits.edit': { screenId: 'new-visit', action: 'update' },
    'visits.delete': { screenId: 'new-visit', action: 'delete' },
    'queue.view': { screenId: 'waiting-queue', action: 'view' },
    'queue.manage': { screenId: 'waiting-queue', action: 'update' },
    'clinical.view': { screenId: 'clinical-exam', action: 'view' },
    'clinical.open': { screenId: 'clinical-exam', action: 'update' },
    'clinical.edit': { screenId: 'clinical-exam', action: 'update' },
    'clinical.complete': { screenId: 'clinical-exam', action: 'update' },
    'prescription.view': { screenId: 'prescription-pad', action: 'view' },
    'prescription.create': { screenId: 'prescription-pad', action: 'create' },
    'prescription.edit': { screenId: 'prescription-pad', action: 'update' },
    'prescription.delete': { screenId: 'prescription-pad', action: 'delete' },
    'prescription.print': { screenId: 'prescription-pad', action: 'view' },
    'lab.view': { screenId: 'clinical-exam', action: 'view' },
    'lab.create': { screenId: 'clinical-exam', action: 'create' },
    'lab.update': { screenId: 'clinical-exam', action: 'update' },
    'lab.delete': { screenId: 'clinical-exam', action: 'delete' },
    'radiology.view': { screenId: 'clinical-exam', action: 'view' },
    'radiology.create': { screenId: 'clinical-exam', action: 'create' },
    'radiology.update': { screenId: 'clinical-exam', action: 'update' },
    'radiology.delete': { screenId: 'clinical-exam', action: 'delete' },
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
    'payments.view': { screenId: 'billing-payments', action: 'view' },
    'payments.create': { screenId: 'billing-payments', action: 'create' },
    'payments.edit': { screenId: 'billing-payments', action: 'update' },
    'payments.delete': { screenId: 'billing-payments', action: 'delete' },
    'reports.view': { screenId: 'clinical-reports', action: 'view' },
    'reports.financial': { screenId: 'clinical-reports', action: 'view' },
    'reports.clinical': { screenId: 'clinical-reports', action: 'view' },
    'settings.view': { screenId: 'system-settings', action: 'view' },
    'settings.edit': { screenId: 'system-settings', action: 'update' },
    'backup.export': { screenId: 'system-settings', action: 'view' },
    'users.view': { screenId: 'system-settings', action: 'view' },
    'users.create': { screenId: 'system-settings', action: 'create' },
    'users.edit': { screenId: 'system-settings', action: 'update' },
    'users.disable': { screenId: 'system-settings', action: 'update' },
    'users.delete': { screenId: 'system-settings', action: 'delete' },
    'roles.manage': { screenId: 'system-settings', action: 'update' },
  };

  const target = permMapping[permission];
  if (target) {
    return checkScreenPermission(
      normRole,
      target.screenId,
      target.action,
      customPermissions,
      allowedScreens,
      specialPermissions
    );
  }

  const permissions = ROLE_PERMISSIONS[normRole];
  return permissions ? permissions.includes(permission) : false;
}

export function isScreenAllowed(screenId: string, allowedScreens?: string[] | null): boolean {
  if (!allowedScreens || !Array.isArray(allowedScreens) || allowedScreens.length === 0) {
    return false;
  }
  const aliases = SCREEN_ALIASES[screenId] || [screenId];
  return aliases.some((alias) => allowedScreens.includes(alias));
}

export function canAccessRoute(
  role: Role | string | undefined | null,
  screenId: string,
  userAllowedScreens?: string[] | null,
  customPermissions?: CustomPermissionsMap | null,
  specialPermissions?: SpecialPermissionsMap | null
): boolean {
  return checkScreenPermission(
    role,
    screenId,
    'view',
    customPermissions,
    userAllowedScreens,
    specialPermissions
  );
}

export function assertPermission(
  role: Role | string | undefined | null,
  permission: Permission,
  actionDescription?: string,
  customPermissions?: CustomPermissionsMap | null,
  allowedScreens?: string[] | null,
  specialPermissions?: SpecialPermissionsMap | null
): void {
  if (!hasPermission(role, permission, customPermissions, allowedScreens, specialPermissions)) {
    const norm = normalizeRole(role);
    const label = ROLE_LABELS[norm];
    const desc = actionDescription ? ` (${actionDescription})` : '';
    throw new Error(
      `غير مصرح: حسابك الحالي (${label}) لا يملك الصلاحية المخصصة لتنفيذ هذا الإجراء${desc} [${permission}].`
    );
  }
}

export function getRolePermissions(role: Role | string | undefined | null): readonly Permission[] {
  const norm = normalizeRole(role);
  return ROLE_PERMISSIONS[norm] || [];
}
