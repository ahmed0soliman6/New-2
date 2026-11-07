# خطة ترقية وتأمين نظام العيادة الطبية (الإصدار v3.0.0)

تهدف هذه الخطة إلى تحويل نظام الصلاحيات من فحص يعتمد على المسمى الوظيفي العام (Role-Only) أو واجهة المستخدم فقط إلى **نظام صلاحيات مخصص وشامل يعمل خادمياً داخل Supabase (RLS + RPC) وفي واجهة React معاً**، بالتزامن مع تأمين عمليات الحذف السحابي والنسخ الاحتياطي وتحديث محرك المزامنة غير المتصلة (Offline Sync) بمعالجة التعارضات التفاعلية وتوحيد الإصدار إلى `v3.0.0`.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> تم اعتماد القرارات المعمارية التالية بناءً على إجاباتك المؤكدة في المرحلة الأولى ومتطلباتك التفصيلية:

- **معالجة تعارضات المزامنة (Offline Sync Conflicts)**: الاحتفاظ بنسخة الخادم ونسخة الجهاز المحلي معاً عند رصد تعارض في رقم المراجعة (`_rev`)، وعرض **نافذة مقارنة تفاعلية (Conflict Comparison Modal)** تتيح للمستخدم مراجعة الفروق واختيار النسخة المعتمدة دون الكتابة الصامتة فوق البيانات.
- **سجل المراجعة الأمني (Security Audit Log)**: حفظ سجلات العمليات الحساسة (الحذف الجماعي، تعديل بيانات المرضى، استعادة النسخة الاحتياطية، وتعديل الصلاحيات) داخل وثيقة نشاط محمية في جدول الإعدادات الحالي (`settings` تحت معرف `_audit_log`) مع حماية RLS تسمح بالإضافة والقراءة للمخولين وتمنع المسح العشوائي.
- **توحيد إصدار النظام (Unified Release v3.0.0)**: اعتماد الإصدار **`3.0.0` / `v3.0.0`** كمصدر مركزي موحد مع توليد تاريخ البناء تلقائياً وربطه بشاشة الإعدادات وبيان النسخة الاحتياطية (Backup Manifest) وملف `CHANGELOG.md`.
- **تطبيق الصلاحيات المخصصة بمعزل عن المسمى الوظيفي**: الدور الوظيفي (`admin`, `doctor`, `secretary`) يعمل كقالب افتراضي أولي فقط؛ أما القرار الفعلي للسماح أو المنع في الواجهة وفي قاعدة البيانات فيعتمد على الصلاحية الممنوحة للمستخدم في سجله داخل `clinic_members.permissions`، بحيث يستطيع السكرتير أو الطبيب تنفيذ أي عملية (مثل حذف مريض، فتح كشف، حذف دفعة مالية، أو استعادة نسخة احتياطية) متى منحه المدير تلك الصلاحية صراحة، ويُمنع منها خادمياً وواجهياً إذا سُحبت منه.

> [!WARNING]
> **عدم التنفيذ التلقائي على قاعدة الإنتاج**: جميع تعديلات قاعدة البيانات والـ RLS والـ RPC ستُكتب في ملف Migration مستقل وجاهز للتشغيل اليدوي الآمن مع تعليمات واضحة دون المساس ببيانات الإنتاج تلقائياً.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. **محرك صلاحيات مخصص ثنائي الطبقة (Client + Database RBAC/ABAC)**: توحيد فحص الصلاحيات عبر دالة خادمية موحدة `has_clinic_permission(p_clinic_id, p_screen_or_perm, p_action)` تقرأ `customPermissions` و`allowedScreens` و`specialPermissions` مباشرة من جدول `clinic_members` للعضو النشط، وتُطبق على سياسات `SELECT / INSERT / UPDATE / DELETE` المنفصلة لكل جدول بعد إزالة سياسة `member_all` العامة المتساهلة.
  2. **صلاحيات مستقلة للعمليات الحساسة**: فصل الصلاحيات الدقيقة بحيث تكون مستقلة وقابلة للمنح أو السحب من لوحة إدارة الصلاحيات:
     - `patients.view`, `patients.create`, `patients.update`, `patients.delete` (إدارة المرضى وحذف مريض مفرد).
     - `clinical.view`, `clinical.create`, `clinical.update`, `clinical.complete` (فتح الكشف وإنهاء الزيارة).
     - `billing.view`, `billing.create`, `billing.update`, `billing.delete` (إدارة وحذف الفواتير والمدفوعات بشكل منفصل عن الملف الطبي).
     - `system.clear_all_data` (الحذف الجماعي السحابي لبيانات التشغيل دون المساس بالإعدادات والكتالوجات والمستخدمين).
     - `backup.export` و `backup.restore` (فصل صلاحية تصدير النسخة الاحتياطية عن صلاحية استعادتها).
     - `demo.manage` (توليد وإدارة البيانات التجريبية المعزولة بعلامة `isDemo: true`).
     - `users.manage` / `roles.manage` (إدارة المستخدمين والصلاحيات).
  3. **تأمين جميع دوال الـ RPC الخادمية**: تحديث وتوفير دوال `check_in_appointment`, `register_walk_in`, `complete_visit`, `create_appointment`, `remove_queue_visit`, `delete_patient`, `add_transaction`, `delete_transaction`, `admin_delete_clinic_user` للتحقق من عضوية العيادة والصلاحية الفعلية من قاعدة البيانات وفحص صحة المدخلات (Input Validation).
  4. **مزامنة Offline متقدمة بمعالجة التعارضات والـ Tombstones**: دعم رقم مراجعة خادمي (`_rev`)، ومعرف عملية حتمي (`mutationId`) يمنع التكرار، وسجل حذف دائم (`Tombstones`) يمنع عودة السجلات المحذوفة عند اتصال جهاز قديم، ومزامنة تزايدية حقيقية تعتمد على `lastSyncedAt`.
  5. **نسخ احتياطي واستعادة موثقة بـ Manifest و Checksum**: تضمين رقم إصدار المخطط (`schemaVersion`)، ومعرف العيادة (`clinic_id`)، وبصمة التحقق الرقمية (`SHA-256 Checksum`)، ومعاينة تفصيلية (Preview) قبل الاستعادة مع آلية استرجاع آمنة (Rollback Snapshot) عند حدوث أي فشل جزئي.
- **Target Audience / Persona**: مدير العيادة، الأطباء، وموظفو الاستقبال في بيئة عيادة واحدة حالياً مع جاهزية معمارية كاملة لدعم تعدد العيادات (`clinic_id`) مستقبلاً.
- **Key Value**: ضمان استحالة تجاوز الصلاحيات عبر المتصفح، ومرونة كاملة للمدير في تفويض أي مهمة لأي موظف، وحماية البيانات الطبية والمالية من الفقدان أو التضارب أو التدمير بالخطأ.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **تخصيص الصلاحيات المرنة (Screen & Special Permissions Modal)**:
     - يفتح المدير نافذة صلاحيات المستخدم، فيجد بجانب صلاحيات الشاشات الأربع (`عرض / إضافة / تعديل / حذف`) قسماً واضحاً لـ **الصلاحيات الخاصة والحساسة (Special Operational Permissions)** مثل: حذف المرضى (`patients.delete`)، حذف السجلات المالية (`billing.delete`)، فتح وإتمام الكشف الطبي (`clinical.complete`)، الحذف الجماعي السحابي (`system.clear_all_data`)، استعادة النسخة الاحتياطية (`backup.restore`)، وإدارة البيانات التجريبية (`demo.manage`).
     - بمجرد الحفظ، تُخزن الصلاحيات في `clinic_members.permissions` في Supabase وتنعكس فوراً في الواجهة وفي سياسات RLS دون الاعتماد على كاش قديم في `localStorage`.
  2. **تدفق الحذف السحابي المحمي (Protected Cloud Clear Flow)**:
     - يظهر زر الحذف السحابي فقط لمن يملك صلاحية `system.clear_all_data`.
     - عند الضغط عليه، تفتح نافذة تأكيد أمنية تعرض: اسم العيادة ومعرفها، قائمة الجداول المشمولة بالحذف، عدد السجلات الفعلي في كل جدول، وتأكيداً بأن الإعدادات والكتالوجات الطبية والمستخدمين لن تُمس.
     - يتطلب التنفيذ كتابة عبارة التأكيد النصية بدقة: **`احذف بيانات العيادة`**، مع قفل الزر أثناء التنفيذ، ثم عرض تقرير تفصيلي بعدد السجلات المحذوفة من كل جدول وحالة النجاح/الفشل وتسجيل العملية في `_audit_log`.
  3. **تدفق النسخ الاحتياطي والاستعادة الموثق (Verified Backup & Restore Preview)**:
     - عند التصدير: يظهر تنبيه أمني بأن الملف يحتوي على بيانات طبية حساسة، ويُولّد ملف JSON مزود بـ `manifest` (يضم `schemaVersion`, `appVersion: v3.0.0`, `clinicId`, `exportedAt`, وعدد السجلات) مع `checksum` محسوب.
     - عند الاستيراد: يتحقق النظام أولاً من صلاحية `backup.restore`، ثم يطابق `clinicId` والـ `checksum`، ويعرض **بطاقة معاينة (Restore Preview)** توضح تاريخ النسخة وعدد السجلات في كل جدول قبل بدء الاستعادة الذرية، مع حفظ نسخة تراجع محلية (Rollback Snapshot) لاسترجاع الحالة السابقة تلقائياً إذا فشل أي جدول.
  4. **تدفق حل تعارضات المزامنة (Offline Conflict Resolution Modal)**:
     - إذا عدّل جهاز قديم سجلاً تم تحديثه على الخادم بإصدار أحدث (`_rev`)، يحتفظ النظام بالنسختين ويعرض إشعاراً ونافذة مقارنة جنبًا إلى جنب (نسخة الخادم مقابل نسخة الجهاز) ليختار المستخدم النسخة المعتمدة بأمان.
- **Visual Identity & Theme**:
  - الحفاظ الكامل على الهوية البصرية الطبية الاحترافية الحالية للعيادة (Dual-Theme Light/Dark Slate `#0c1322` / `#111A2E` مع تباينات Teal `#00c2cb` و Emerald/Amber/Crimson الدلالية).
  - تطبيق قواعد `tabular-nums` (`font-mono`) على جميع الأرقام المالية، العدادات، التواريخ، أرقام الإصدارات، وبصمات التحقق (`Checksum`).
  - التزام صارم ببنية البطاقات أحادية المستوى (Single-Elevation Depth) مع حدود دقيقة `1px` دون تداخل بطاقات مزدحم أو أشرطة حالة وهمية.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: التحقق من الصلاحيات عبر الدالة الخادمية `has_clinic_permission` بدلاً من فحص `role` الثابت**
  - *Chosen Approach*: بناء دالة SQL موحدة `public.has_clinic_permission(p_clinic_id text, p_permission text, p_action text default 'view')` تقرأ سجل المستخدم من `public.clinic_members` وتفحص:
    1. هل `auth.uid()` موجود وعضو نشط (`is_active = true`) في `p_clinic_id`؟
    2. هل يملك صلاحية صريحة في `permissions->'specialPermissions'->>p_permission` أو `permissions->'customPermissions'->screen->>p_action`؟
    3. إذا لم توجد تخصيصات صريحة، يرجع إلى الإعداد الافتراضي للدور (`admin`, `doctor`, `secretary`).
  - *Why*: يحقق مرونة 100% للمدير؛ فإذا منح السكرتير صلاحية `patients.delete` أو `clinical.complete`، تسمح له قاعدة البيانات فوراً، وإذا لم يمنحه، ترفض قاعدة البيانات العملية حتى لو أرسل طلباً مباشراً خارج المتصفح.
  - *Alternatives Considered*: الاعتماد على `is_clinic_doctor_or_admin` فقط — مرفوض لأنه يمنع السكرتير حتى عندما يمنحه المدير الصلاحية صراحة، أو يمنح الطبيب صلاحيات قد يرغب المدير في تقييدها.

- **Decision 2: استبدال سياسة `member_all` بسياسات `SELECT / INSERT / UPDATE / DELETE` مفصلة لكل جدول**
  - *Chosen Approach*: حذف سياسة `member_all` (`FOR ALL`) من جميع الجداول، لأن سياسات PostgreSQL السماحية (`PERMISSIVE`) تعمل بمنطق `OR` مما يجعل وجود `member_all` يبطل أي سياسة تقييد إضافية. بدلاً منها، يتم إنشاء 4 سياسات مستقلة (`_select`, `_insert`, `_update`, `_delete`) لكل جدول تستدعي `public.has_clinic_permission`.
  - *Why*: يضمن عدم قدرة أي مستخدم على الحذف أو التعديل إلا بوجود الصلاحية المخصصة المقابلة للجدول والعملية.

- **Decision 3: المزامنة غير المتصلة باستخدام `_rev` و Tombstones ومعرفات عمليات حتمية**
  - *Chosen Approach*:
    - توليد `mutationId` حتمي بصيغة `${clinicId}:${table}:${id}:${op}:${baseRev}` بدلاً من `Date.now()` لمنع تكرار العمليات عند إعادة المحاولة.
    - تضمين حقل `_rev` (رقم المراجعة) و`_deleted` (في جدول/مخزن Tombstones) لمنع الكتابة فوق إصدار أحدث على الخادم ومنع عودة السجلات المحذوفة.
    - تحديث `syncTableIncremental` لاستخدام `.gt('updated_at', lastSyncedAt)` فعلياً ودمج التغييرات التزايدية مع الكاش المحلي بدلاً من جلب الجدول بالكامل في كل دورة.
  - *Why*: يمنع فقدان البيانات عند عمل أكثر من جهاز (مثل جهاز الطبيب وجهاز الاستقبال) في نفس العيادة.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                        React Application (v3.0.0)                            │
│                                                                              │
│  ┌─────────────────────────┐   ┌─────────────────────────┐                   │
│  │   AuthContext & RBAC    │   │ ScreenPermissionsModal  │                   │
│  │  - Live DB Permissions  │◄──┤ - Screen CRUD Matrix    │                   │
│  │  - Special Perms Check  │   │ - Special Perms Toggles │                   │
│  └───────────┬─────────────┘   └───────────┬─────────────┘                   │
│              │                             │                                 │
│  ┌───────────▼─────────────┐   ┌───────────▼─────────────┐                   │
│  │ Protected Operations UI │   │  OfflineSync Engine v2  │                   │
│  │ - CloudClearConfirmModal│   │ - Deterministic Outbox  │                   │
│  │ - BackupPreview & Audit │   │ - _rev OCC & Tombstones │                   │
│  │ - Patient Update Guard  │   │ - ConflictCompareModal  │                   │
│  └───────────┬─────────────┘   └───────────┬─────────────┘                   │
└──────────────┼─────────────────────────────┼─────────────────────────────────┘
               │ PostgREST / RPC Calls       │ Incremental Sync (.gt updated_at)
               ▼                             ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                     Supabase PostgreSQL (Multi-Clinic)                       │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ public.has_clinic_permission(p_clinic_id, p_perm_or_screen, p_action)  │  │
│  │  1. Verify auth.uid() in clinic_members (clinic_id, is_active = true)  │  │
│  │  2. Check explicit specialPermissions / customPermissions JSONB        │  │
│  │  3. Fallback to role defaults only when not explicitly overridden      │  │
│  └──────────────────┬───────────────────────────────────┬─────────────────┘  │
│                     │                                   │                    │
│  ┌──────────────────▼─────────────────┐  ┌──────────────▼─────────────────┐  │
│  │ Granular Table RLS Policies        │  │ Hardened Atomic RPC Functions  │  │
│  │ (No permissive 'member_all')       │  │ - check_in_appointment         │  │
│  │ - SELECT / INSERT / UPDATE / DELETE│  │ - register_walk_in             │  │
│  │ - Separate Medical vs Billing Del  │  │ - complete_visit               │  │
│  │ - Settings & _audit_log Protection │  │ - create_appointment           │  │
│  └────────────────────────────────────┘  │ - remove_queue_visit           │  │
│                                          │ - delete_patient               │  │
│                                          │ - add/delete_transaction       │  │
│                                          │ - admin_delete_clinic_user     │  │
│                                          └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Model & Permission Mapping

1. **بنية الصلاحيات في `clinic_members.permissions` (JSONB)**:
   - `customPermissions`: خريطة الشاشات `{ [screenId]: { view, create, update, delete } }`.
   - `specialPermissions`: خريطة الصلاحيات الدقيقة المستقلة:
     - `patients.update`: تعديل بيانات المريض الأساسية والطبية.
     - `patients.delete`: حذف ملف مريض مفرد.
     - `clinical.open`: فتح الكشف الطبي وبدء الزيارة.
     - `clinical.complete`: اعتماد وإنهاء الكشف الطبي والروشتة.
     - `billing.delete`: حذف الفواتير أو المدفوعات أو الحركات المالية.
     - `system.clear_all_data`: تنفيذ الحذف الجماعي السحابي لبيانات التشغيل.
     - `backup.export`: تصدير نسخة احتياطية.
     - `backup.restore`: استعادة نسخة احتياطية إلى قاعدة البيانات.
     - `demo.manage`: توليد أو مسح البيانات التجريبية (`isDemo: true`).
     - `users.manage`: إدارة حسابات المستخدمين وتخصيص الصلاحيات.
2. **سجل المراجعة الأمني (`settings` -> `id = '_audit_log'`)**:
   - يخزن مصفوفة أحداث أمنية موثقة، يشمل كل حدث: `eventId`, `timestamp`, `actorUid`, `actorUsername`, `clinicId`, `action`, `permissionUsed`, `affectedTables`, `recordCounts`, و `status` (`SUCCESS` / `PARTIAL_FAILURE` / `REJECTED`).
3. **بيان النسخة الاحتياطية (`Backup Manifest v3.0.0`)**:
   - يتضمن: `schemaVersion: 3`, `appVersion: 'v3.0.0'`, `clinicId`, `exportedAt`, `checksum` (SHA-256 لمحتوى الجداول)، و `tableCounts`، مع التحقق الصارم قبل أي عملية استعادة.

### Interactive Component & State Mapping

- **تحديث صلاحيات الجلسة الفوري (`AuthContext`)**:
  - الاستماع لأي تحديث على صف المستخدم في `clinic_members` وإعادة جلب الصلاحيات مباشرة من Supabase عند تحميل الجلسة وعند تعديل الصلاحيات، مع إلغاء الاعتماد الأمني على الكاش المحلي في `localStorage` إذا ألغيت الصلاحية خادمياً.
- **حماية تعديل المريض (`handleUpdatePatient`)**:
  - التحقق من صلاحية `patients.update`، ومنع تغيير الحقول الثابتة (`clinic_id`, `patientId`, `createdAt`, `createdBy`)، والتحقق من صحة طول الاسم ورقم الهاتف والرقم الطبي والتواريخ، وتسجيل التعديلات الطبية في `_audit_log`.
- **عزل بيانات الـ Demo (`demoDataGenerator.ts` & `database.ts`)**:
  - استبدال جميع الأسماء بألقاب تجريبية صريحة (`مريض تجريبي 001` ... `مريض تجريبي 008`)، واستخدام أرقام هاتف غير قابلة للاتصال (`00000000000`)، وأرقام قومية غير حقيقية (`00000000000000`)، ودمغ كل سجل بـ `isDemo: true`، وحصر أزرار توليدها بصلاحية `demo.manage`.
- **حزمة الاختبارات الشاملة (`npm test` / `node --test`)**:
  - تغطية الـ 10 سيناريوهات للصلاحيات المخصصة (السكرتير والطبيب مع/بدون صلاحيات الحذف وفتح الكشف وحذف المدفوعات، المستخدم غير النشط، العزل بين العيادات، وإلغاء الصلاحيات)، واختبارات الحذف الجماعي، واختبارات تعارضات الـ Offline والـ Tombstones، واختبارات النسخ الاحتياطي والـ Checksum والـ Rollback.
