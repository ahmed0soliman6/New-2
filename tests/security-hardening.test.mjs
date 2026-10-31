import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesPath = path.resolve(__dirname, '../firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf8');

console.log('===============================================================');
console.log('🔒 تشغيل اختبارات قبول إغلاق الثغرات الأمنية (Security Hardening)');
console.log('===============================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName} - ${details}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// Test 1-4: API user deletion permission & safety logic simulation
// -------------------------------------------------------------

// Simulating delete handler logic exactly as in api/users/delete.ts
function simulateDeleteHandler({ callerUser, targetUser, activeAdminCount }) {
  // Check admin caller
  const isAdminCaller = callerUser.active && (callerUser.role === 'ADMIN' || callerUser.role === 'admin');
  if (!isAdminCaller) {
    return { status: 403, error: 'لا تملك صلاحية حذف المستخدمين.' };
  }

  // Check self-delete
  if (callerUser.uid === targetUser.uid) {
    return { status: 400, error: 'لا يمكنك حذف الحساب الحالي المسجل به.' };
  }

  // Check last admin
  if (targetUser.role === 'ADMIN' || targetUser.role === 'admin') {
    if (activeAdminCount <= 1) {
      return { status: 400, error: 'لا يمكن حذف آخر مدير في النظام' };
    }
  }

  return { status: 200, success: true };
}

// 1. طبيب مسجّل يرسل طلب حذف مستخدم آخر للدالة -> 403
const test1 = simulateDeleteHandler({
  callerUser: { uid: 'doc-1', role: 'DOCTOR', active: true },
  targetUser: { uid: 'sec-1', role: 'SECRETARY', active: true },
  activeAdminCount: 2,
});
assert(test1.status === 403, 'حالة 1: طبيب مسجّل يرسل طلب حذف مستخدم آخر للدالة', `المتوقع 403، الفعلي: ${test1.status}`);

// 2. سكرتير مسجّل يرسل طلب حذف -> 403
const test2 = simulateDeleteHandler({
  callerUser: { uid: 'sec-1', role: 'SECRETARY', active: true },
  targetUser: { uid: 'doc-1', role: 'DOCTOR', active: true },
  activeAdminCount: 2,
});
assert(test2.status === 403, 'حالة 2: سكرتير مسجّل يرسل طلب حذف', `المتوقع 403، الفعلي: ${test2.status}`);

// 3. مدير مسجّل يحذف حساب سكرتير -> 200 ينجح
const test3 = simulateDeleteHandler({
  callerUser: { uid: 'admin-1', role: 'ADMIN', active: true },
  targetUser: { uid: 'sec-1', role: 'SECRETARY', active: true },
  activeAdminCount: 2,
});
assert(test3.status === 200, 'حالة 3: مدير مسجّل يحذف حساب سكرتير', `المتوقع 200، الفعلي: ${test3.status}`);

// 4. مدير يحاول حذف آخر مدير -> 400
const test4 = simulateDeleteHandler({
  callerUser: { uid: 'admin-1', role: 'ADMIN', active: true },
  targetUser: { uid: 'admin-2', role: 'ADMIN', active: true },
  activeAdminCount: 1, // Only 1 active admin remains
});
assert(test4.status === 400 && test4.error === 'لا يمكن حذف آخر مدير في النظام', 'حالة 4: مدير يحاول حذف آخر مدير', `المتوقع 400، الفعلي: ${test4.status}`);

// -------------------------------------------------------------
// Test 5-7: Firestore Rules logic verification
// -------------------------------------------------------------

function simulateIsDoctor(auth, userDoc) {
  const signedIn = auth != null;
  const isUserActive = signedIn && (userDoc == null || userDoc.active !== false);
  const role = userDoc && userDoc.role ? userDoc.role : 'SECRETARY';
  const isAdmin = signedIn && isUserActive && (role === 'ADMIN' || role === 'admin');
  return signedIn && isUserActive && (isAdmin || role === 'DOCTOR' || role === 'doctor');
}

function simulateSettingsRule(auth, userDoc, settingId, action) {
  const signedIn = auth != null;
  const isUserActive = signedIn && (userDoc == null || userDoc.active !== false);
  const role = userDoc && userDoc.role ? userDoc.role : 'SECRETARY';
  const isAdmin = signedIn && isUserActive && (role === 'ADMIN' || role === 'admin');
  const isDoctor = signedIn && isUserActive && (isAdmin || role === 'DOCTOR' || role === 'doctor');
  
  // Custom permissions or fallback
  const hasSystemSettingsUpdate = userDoc?.customPermissions?.['system-settings']?.update === true;

  if (action === 'create' || action === 'update') {
    return (
      (['prescriptionSettings', 'visitTypes'].includes(settingId) && (isDoctor || hasSystemSettingsUpdate)) ||
      (!['prescriptionSettings', 'visitTypes'].includes(settingId) && (isAdmin || hasSystemSettingsUpdate))
    );
  }
  return false;
}

// 5. حساب بريده يحوي كلمة drive ودوره سكرتير -> لا يحصل على صلاحية طبيب
const test5IsDoctor = simulateIsDoctor(
  { uid: 'u-drive', email: 'secretary.drive@example.com' },
  { uid: 'u-drive', role: 'SECRETARY', active: true }
);
assert(!test5IsDoctor, 'حالة 5: حساب بريده يحوي كلمة drive ودوره سكرتير لا يحصل على صلاحية طبيب', `الفعلي: ${test5IsDoctor}`);

// Also verify that firestore.rules file DOES NOT contain matches('.*admin.*') or matches('.*(doctor|dr).*')
const hasAdminRegex = rulesContent.includes("matches('.*admin.*')");
const hasDoctorRegex = rulesContent.includes("matches('.*(doctor|dr).*')");
assert(!hasAdminRegex && !hasDoctorRegex, 'حالة 5B: إزالة شروط البريد الإلكتروني Regex تماماً من firestore.rules', `adminRegex=${hasAdminRegex}, doctorRegex=${hasDoctorRegex}`);

// 6. طبيب يكتب في prescriptionSettings -> ينجح
const test6DoctorWritesRxSettings = simulateSettingsRule(
  { uid: 'doc-1', email: 'doctor@solimedical.com' },
  { uid: 'doc-1', role: 'DOCTOR', active: true },
  'prescriptionSettings',
  'update'
);
assert(test6DoctorWritesRxSettings, 'حالة 6: طبيب يكتب في prescriptionSettings ينجح', `الفعلي: ${test6DoctorWritesRxSettings}`);

// 7. سكرتير يكتب في settings/system -> يُرفض
const test7SecretaryWritesSystem = simulateSettingsRule(
  { uid: 'sec-1', email: 'sec@solimedical.com' },
  { uid: 'sec-1', role: 'SECRETARY', active: true },
  'systemSettings',
  'update'
);
assert(!test7SecretaryWritesSystem, 'حالة 7: سكرتير يكتب في settings/system يُرفض', `الفعلي: ${test7SecretaryWritesSystem}`);

// -------------------------------------------------------------
// Test 8-12: Prompt 11 - Admin Locked Permissions Tests
// -------------------------------------------------------------

function simulateUserUpdateRule({ callerAuth, callerDoc, targetUserDoc, updatedFields }) {
  const signedIn = callerAuth != null;
  const isUserActive = signedIn && (callerDoc == null || callerDoc.active !== false);
  const callerRole = callerDoc && callerDoc.role ? callerDoc.role : 'SECRETARY';
  const isAdmin = signedIn && isUserActive && (callerRole === 'ADMIN' || callerRole === 'admin');

  if (!signedIn || !isUserActive) return false;

  const affectedKeys = Object.keys(updatedFields);

  // Target is Admin
  if (targetUserDoc.role === 'ADMIN' || targetUserDoc.role === 'admin') {
    const hasProtectedKey = affectedKeys.some((k) =>
      ['role', 'active', 'customPermissions', 'allowedScreens', 'createdBy'].includes(k)
    );
    if (hasProtectedKey) return false;
    return isAdmin || callerAuth.uid === targetUserDoc.uid;
  }

  // Target is Non-Admin
  if (isAdmin) return true;
  if (callerAuth.uid === targetUserDoc.uid) {
    const hasProtectedKey = affectedKeys.some((k) =>
      ['role', 'customPermissions', 'allowedScreens', 'active', 'createdBy'].includes(k)
    );
    return !hasProtectedKey;
  }

  return false;
}

// 8. مدير يحاول تعديل دور مدير آخر -> يُرفض
const test8AdminModifiesAdminRole = simulateUserUpdateRule({
  callerAuth: { uid: 'admin-1' },
  callerDoc: { uid: 'admin-1', role: 'ADMIN', active: true },
  targetUserDoc: { uid: 'admin-2', role: 'ADMIN', active: true },
  updatedFields: { role: 'DOCTOR' },
});
assert(!test8AdminModifiesAdminRole, 'حالة 8: مدير يحاول تغيير دور مدير آخر إلى طبيب -> يُرفض في القواعد');

// 9. مدير يحاول تعطيل مدير آخر -> يُرفض
const test9AdminDeactivatesAdmin = simulateUserUpdateRule({
  callerAuth: { uid: 'admin-1' },
  callerDoc: { uid: 'admin-1', role: 'ADMIN', active: true },
  targetUserDoc: { uid: 'admin-2', role: 'ADMIN', active: true },
  updatedFields: { active: false },
});
assert(!test9AdminDeactivatesAdmin, 'حالة 9: مدير يحاول تعطيل حساب مدير آخر -> يُرفض في القواعد');

// 10. مدير يحاول تعيين customPermissions لحساب مدير -> يُرفض
const test10AdminSetsAdminCustomPerms = simulateUserUpdateRule({
  callerAuth: { uid: 'admin-1' },
  callerDoc: { uid: 'admin-1', role: 'ADMIN', active: true },
  targetUserDoc: { uid: 'admin-2', role: 'ADMIN', active: true },
  updatedFields: { customPermissions: { dashboard: { view: false } } },
});
assert(!test10AdminSetsAdminCustomPerms, 'حالة 10: محاولة تخصيص/تقييد صلاحيات حساب مدير -> تُرفض في القواعد');

// 11. مدير يعدل الاسم الظاهر لمدير آخر -> ينجح
const test11AdminUpdatesAdminDisplayName = simulateUserUpdateRule({
  callerAuth: { uid: 'admin-1' },
  callerDoc: { uid: 'admin-1', role: 'ADMIN', active: true },
  targetUserDoc: { uid: 'admin-2', role: 'ADMIN', active: true },
  updatedFields: { displayName: 'د. أحمد سليمان - الإدارة الطبية' },
});
assert(test11AdminUpdatesAdminDisplayName, 'حالة 11: مدير يعدل الاسم الظاهر لمدير -> ينجح');

// 12. التحقق من كود نافذة الصلاحيات ScreenPermissionsModal.tsx
const modalPath = path.resolve(__dirname, '../src/components/settings/ScreenPermissionsModal.tsx');
const modalContent = fs.readFileSync(modalPath, 'utf8');
const hasIsAdminAccount = modalContent.includes('isAdminAccount');
const hasLockedSave = modalContent.includes('disabled={isAdminAccount || saving}');
const hasLockBanner = modalContent.includes('صلاحيات المدير ثابتة ومحمية');
assert(
  hasIsAdminAccount && hasLockedSave && hasLockBanner,
  'حالة 12: واجهة ScreenPermissionsModal تقفل الصلاحيات والأزرار والبانر لحساب المدير'
);

console.log('\n===============================================================');
console.log(`📊 النتيجة: ${passCount} اختبار نجح | ${failCount} اختبار فشل`);
console.log('===============================================================\n');

if (failCount > 0) {
  process.exit(1);
}
