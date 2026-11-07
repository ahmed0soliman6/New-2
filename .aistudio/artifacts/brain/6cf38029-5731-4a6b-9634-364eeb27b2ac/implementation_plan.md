# خطة تنفيذ الإصلاحات الأمنية الخمسة (Soli Medical v3.0.0)

## 1. ضمان قابلية إعادة تشغيل ملفات SQL (Idempotency)
* **الملفات المستهدفة**:
  * `supabase/migrations/20261107_fix_custom_permissions_rls.sql`
  * `supabase/full_setup.sql`
  * `supabase/schema.sql`
* **التعديل**:
  * إضافة أوامر `DROP POLICY IF EXISTS` الصريحة لسياسات جدول `clinic_members` (`members_select`, `members_insert`, `members_update`, `members_delete`)، وكذلك سياسات جدول `clinics` (`clinics_select`, `clinics_insert`, `clinics_update`, `clinics_delete`) وجدول `usernames` (`usernames_select`, `usernames_insert`, `usernames_update`, `usernames_delete`) قبل إعادة إنشائها، لضمان إمكانية تشغيل أي من الملفات الثلاثة مرتين متتاليتين أو أكثر دون أي خطأ `policy already exists`.

---

## 2. حماية سجل المراجعة (`_audit_log`) كإضافة فقط (Append-Only)
* **في طبقة قاعدة البيانات (`supabase/migrations/20261107_fix_custom_permissions_rls.sql` و`supabase/full_setup.sql` و`supabase/schema.sql`)**:
  * تعديل سياسات جدول `public.settings`:
    * منع أي `UPDATE` أو `DELETE` أو `INSERT` مباشر من العميل على السجلات التي تحمل `id = '_audit_log'` أو تبدأ بـ `_audit_log:` عبر شرط `id <> '_audit_log' AND id NOT LIKE '_audit_log:%'` في سياسات `settings_insert` و`settings_update` و`settings_delete`.
  * إنشاء دالة RPC محمية `public.append_audit_log(p_clinic_id text, p_entry jsonb)` من نوع `SECURITY DEFINER SET search_path = public`:
    * تتحقق من أن المستدعي عضو نشط في العيادة عبر `public.is_clinic_member(p_clinic_id)`.
    * تتحقق من عدم تزوير حقل `actorUid` (أو تفرضه مساوياً لـ `auth.uid()::text`).
    * تضيف الحدث الجديد في وثيقة `_audit_log` داخل جدول `public.settings` (إضافة للأعلى مع الاحتفاظ بآخر 250 سجل مراجعة دون السماح بحذف أو تعديل السجلات السابقة من طرف العميل).
    * منح صلاحية التنفيذ `GRANT EXECUTE ON FUNCTION public.append_audit_log(text, jsonb) TO authenticated;`.
  * حفظ نسخة مستقلة من الدالة في `supabase/functions-sql/append_audit_log.sql`.
* **في طبقة التطبيق (`src/services/auditLog.ts`)**:
  * تحديث `recordAuditLog` لاستدعاء `supabase.rpc('append_audit_log', { p_clinic_id: clinicId, p_entry: fullEntry })` بدلاً من `upsert` المباشر على جدول `settings`.

---

## 3. إزالة القيمة الافتراضية المكتوبة صراحة `'solimedical-new2'`
* **`src/services/supabase.ts`**:
  * إزالة القيمة الافتراضية `'solimedical-new2'` تماماً.
  * قراءة `clinicSlug` من `import.meta.env.VITE_CLINIC_SLUG?.trim() || ''`.
  * تحديث `supabaseConfigured` ليشترط توفر `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` و`VITE_CLINIC_SLUG` معاً، وإرجاع رسالة خطأ عربية واضحة في `supabaseConfigError` إذا لم يتم ضبط `VITE_CLINIC_SLUG`.
* **مسارات الـ API الخادمية (`api/users/create.ts`, `api/users/delete.ts`, `api/users/reset-password.ts`, `api/users/recover-admin.ts`)**:
  * إزالة `'solimedical-new2'` من جميع الملفات الأربعة.
  * قراءة معرف العيادة من `(body.clinicId || process.env.VITE_CLINIC_SLUG || process.env.CLINIC_SLUG || '').trim()`.
  * إذا كان معرف العيادة فارغاً، إرجاع استجابة خطأ `400` أو `500` برسالة عربية واضحة: `"معرّف العيادة غير مضبوط. يرجى ضبط متغير البيئة VITE_CLINIC_SLUG أو CLINIC_SLUG قبل المتابعة."` دون المتابعة بأي قيمة افتراضية.
* **توثيق التأسيس (`README.md` و`CLINIC_SETUP_GUIDE.md` و`.env.example`)**:
  * توثيق خطوات إنشاء عيادة جديدة بالترتيب:
    1. تشغيل `supabase/full_setup.sql`.
    2. إدراج سجل العيادة في جدول `public.clinics` (`INSERT INTO public.clinics ...`).
    3. ضبط `VITE_CLINIC_SLUG` و`CLINIC_SLUG` في البيئة.
    4. إنشاء أول مستخدم مدير (`admin`) وربطه في `public.clinic_members` و`public.usernames`.

---

## 4. تحسينات التحقق في `delete_patient` وسياسات `SELECT`
* **دالة `public.delete_patient(p_clinic_id text, p_patient_id text, p_mode text)`**:
  * التحقق الصارم من قيمة `p_mode`: إذا لم تكن `'file_only'` أو `'everything'` يتم رفع استثناء `Invalid delete mode: %. Allowed values are file_only or everything`.
  * التحقق من وجود المريض في `public.patients` ضمن نفس `p_clinic_id` قبل الحذف: إذا لم يُوجد المريض يتم رفع استثناء `Patient not found: % in clinic %`.
* **تشديد سياسات `SELECT` على الجداول السريرية الحساسة دون كسر الشاشات**:
  * **`appointments`**: اشتراط `public.has_clinic_permission(clinic_id, 'appointments', 'view') OR public.has_clinic_permission(clinic_id, 'queue', 'view') OR public.has_clinic_permission(clinic_id, 'dashboard', 'view')` (جميع الأدوار الافتراضية تمتلكها، ولكن إذا سحب المدير صلاحيات العرض من مستخدم مخصص يمنعه محرك RLS).
  * **`visits`**: اشتراط `public.has_clinic_permission(clinic_id, 'queue', 'view') OR public.has_clinic_permission(clinic_id, 'examination', 'view') OR public.has_clinic_permission(clinic_id, 'emr', 'view') OR public.has_clinic_permission(clinic_id, 'billing', 'view') OR public.has_clinic_permission(clinic_id, 'dashboard', 'view')`.
  * **`prescriptions`**: اشتراط `public.has_clinic_permission(clinic_id, 'prescription', 'view') OR public.has_clinic_permission(clinic_id, 'examination', 'view') OR public.has_clinic_permission(clinic_id, 'emr', 'view')`.

---

## 5. اختبارات PostgreSQL الفعلية الشاملة
* إنشاء وتشغيل اختبار تكاملي حقيقي في `tests/postgres-migration-rls.test.mjs` يقوم بتشغيل محرك PostgreSQL مع تهيئة مخطط `auth` (`auth.uid()`, `auth.role()`) والأدوار (`authenticated`, `anon`) وتنفيذ ملف الترحيل `supabase/migrations/20261107_fix_custom_permissions_rls.sql` فعلياً للتحقق من:
  1. نجاح تشغيل ملف الترحيل **مرتين متتاليتين** دون أي خطأ.
  2. منع السكرتير الافتراضي من حذف مريض مباشرة (`DELETE FROM public.patients`) أو عبر `public.delete_patient`.
  3. السماح لسكرتير يملك الصلاحية المخصصة `patients.delete = true` بالحذف في وضع `'file_only'`، ورفضه في وضع `'everything'`.
  4. رفض `delete_patient` عند تمرير `p_mode` غير صالح أو عند محاولة حذف مريض غير موجود.
  5. العزل التام بين عيادتين (`clinic_a` و`clinic_b`).
  6. منع العضو غير النشط (`is_active = false`) من قراءة أي بيانات.
  7. منع أي مستخدم (حتى المدير) من عمل `UPDATE` أو `DELETE` مباشر على وثيقة `_audit_log` في جدول `public.settings`، والسماح بالإضافة فقط عبر `public.append_audit_log`.
* التحقق النهائي من نجاح `npm run lint` و`npm run build` و`npm test`.
