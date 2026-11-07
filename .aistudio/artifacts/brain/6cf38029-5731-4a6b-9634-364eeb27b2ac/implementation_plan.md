# خطة العمل: إصلاح التنبيهات اللحظية، صلاحيات ومواعيد السكرتيرة، وانعكاس الحذف السحابي اللحظي

## 1. تشخيص الأسباب الجذرية (Root Cause Analysis)

### المشكلة 1: تنبيهات الزيارة والكشف والاستراحة لا تصل للمستخدم الآخر إلا بعد Refresh
1. **السبب الجذري الأساسي في مسار Realtime**:
   - في `src/services/repositories/common.ts` و `settingsRepo.ts`، تم استبدال اشتراكات قنوات Supabase Realtime الحية (`supabase.channel(...)`) بـ polling كل 60 ثانية (`setInterval(..., 60000)`) والاستماع إلى حدث المتصفح المحلي `soli_supabase_mutated` الذي يقتصر فقط على نفس التبويب/المتصفح!
   - تنبيهات استراحة الطبيب (`CLINIC_STATUS`) وتنبيهات الإشعارات (`LATEST_ALERT`) كانت تعتمد على استدعاءات `subscribeToClinicStatus` و `subscribeToLatestAlert` التي لا تستقبل أي حدث فوري من السحابة إذا لم يتم تفعيل قناة Postgres Changes الحية.
   - في `App.tsx` (الأسطر 1437-1444): تعتمد مقارنة الزيارات على `isInitialVisitsLoadRef` و `previousVisitsMapRef`، ولكن عندما تصل بيانات من خادم أو مستخدم آخر متأخرة أو بعد دقيقة، لا يكون هناك حدث لحظي يوقظ التطبيق فوراً.
2. **الحل الهندسي**:
   - إنشاء اشتراك Supabase Realtime حقيقي ونشط وموحّد لكل عيادة (`supabase.channel('clinic_realtime:' + clinicId)`) يستمع لتغييرات `INSERT` و `UPDATE` و `DELETE` على جداول: `visits`، `appointments`، `settings` (مع فلتر العيادة `clinic_id=eq.${clinicId}`).
   - عند استقبال أي تغيير سحابي من مستخدم آخر، يتم فوراً إطلاق `notifyTableMutated(table, false)` ومزامنة البيانات في أقل من 200ms.
   - نقل أحداث استراحة الطبيب والتنبيهات المباشرة فوراً عبر قناة Realtime Broadcast أو عبر التحديث المباشر لصف `settings` المرخص.
   - **منع التكرار وحماية التحميل الأول**: حفظ معرف التنبيه `alertId` في `localStorage` مع تاريخ الإدراج، وتجاهل أي تنبيه تم عرضه مسبقاً للمستخدم، وتجاهل أي حدث عمره يتجاوز 5 دقائق عند أول تحميل للصفحة، وتنظيف السجل تلقائياً كل 24 ساعة.

---

### المشكلة 2: السكرتيرة تحصل على "غير مصرح لحسابك بتنفيذ هذه العملية الطبية" عند إضافة موعد
1. **السبب الجذري**:
   - في `src/services/firestoreWorkflows.ts`:
     ```typescript
     function toArabicError(error: unknown, fallbackMessage: string): Error {
       const raw = error instanceof Error ? error.message : String((error as any)?.message || error || '');
       ...
       if (raw.includes('Unauthorized') || raw.includes('caller must be an active doctor or admin')) {
         return new Error('غير مصرح لحسابك بتنفيذ هذه العملية الطبية.');
       }
     ```
     أي خطأ يحمل كلمة `Unauthorized` أو نص موروث `caller must be an active doctor or admin` (حتى لو كان من خطوة ثانوية بعد إنشاء الموعد مثل محاولة تحديث جدول محمي آخر، أو عدم تطابق صلاحية فرعية) يتحول فورياً إلى هذه الجملة الجافة والمضللة!
   - في `AppointmentsScreen.tsx`: كان النموذج يعرض فوراً "تم حفظ الموعد بنجاح ✓" قبل اكتمال وعد `onAddAppointment(newApp)` (`Promise`)، مما يربك المستخدم برؤية نجاح يتبعه تنبيه خطأ!
2. **الحل الهندسي**:
   - جعل دالة `onAddAppointment` في `App.tsx` ترجع `Promise<boolean>` وتنتظر نجاح `createAppointmentTransaction` بالكامل.
   - في `AppointmentsScreen.tsx`: انتظار نجاح العملية الفعلي في قاعدة البيانات أولاً قبل إظهار رسالة النجاح وتفريغ النموذج.
   - إزالة النص المضلل وغير المستخدم `caller must be an active doctor or admin` وتحديث `toArabicError` للتمييز بدقة بين:
     - رفض صلاحية إضافة المواعيد `appointments.create`.
     - انتهاء الجلسة أو تعذر التحقق من هوية المستخدم.
     - خطأ تسجيل المراجعة أو خطوة ما بعد الحفظ.
   - إضافة اختبارات PostgreSQL PGlite حقيقية تثبت أن `has_clinic_permission` و `create_appointment` تنجح بنسبة 100% للسكرتيرة بالوضع الافتراضي ومع الصلاحيات المخصصة `customPermissions` و `specialPermissions`.

---

### المشكلة 3: الحذف السحابي (Clear All Data) لا ينعكس عند المستخدمين الآخرين (الصور المرفقة)
1. **السبب الجذري**:
   - المستخدم أجرى الحذف السحابي من حساب المدير (admin)، فمُسحت الجداول في قاعدة بيانات السحابة وتفرغت الواجهة عنده (الصورة 1).
   - لكن عند مستخدم آخر (الصورة 2: الطبيب أحمد سليمان)، ظلت بيانات المرضى معروضة من الكاش المحلي `IndexedDB` المخزن على جهازه، لأن المزامنة التزايدية `syncTableIncremental` تبحث فقط عن السجلات الأحدث من `lastSyncedAt`:
     ```typescript
     if (useIncremental && lastSyncedAt) {
       query = query.gt('updated_at', lastSyncedAt);
     }
     ```
     وعندما تُحذف الصفوف من السحابة بـ `DELETE`، فإن استعلام `query.gt('updated_at', ...)` يُرجع مصفوفة فارغة `[]`، فيظن جهاز المستخدم الآخر أنه "لا توجد تعديلات جديدة" ويُبقي صفوف المرضى القديمة المخزنة محلياً في جهازه!
   - كما لم تكن هناك إشارة سحابية (Cloud Purge Marker أو Realtime Event) تُبلغ الأجهزة الأخرى بحدوث مسح شامل للجداول لتفريغ الكاش المحلي التابع لها.
2. **الحل الهندسي**:
   - عند تنفيذ الحذف السحابي الشامل (`clearAllDatabaseCollections`)، يتم تسجيل وثيقة في جدول `settings` بالمعرف `_database_generation` أو `_cache_invalidation` تحمل طابعاً زمنياً ورقم جيل جديد للبيانات (`dbEpoch: Date.now()`).
   - عند مزامنة أي جهاز آخر، يقارن جهازه `dbEpoch` الحالي مع المسجل محلياً؛ إذا وجد أن الجيل تغير أو حدث مسح شامل، يقوم فوراً بتفريغ الجداول التشغيلية من `IndexedDB` ومن الحالة في الذاكرة (`forceFull = true`) وتحديث العرض فوراً.
   - بث حدث Realtime عبر القناة الموحدة ليفرغ المتصفحات المفتوحة الأخرى في نفس اللحظة تلقائياً.

---

## 2. خطوات التنفيذ

### خطوة 1: تفعيل اشتراك Supabase Realtime اللحظي بين المستخدمين
- إنشاء وحدة موحدة `src/services/realtimeSync.ts` تشترك في قناة Realtime للعيادة الحالية وتستقبل أحداث `INSERT` و `UPDATE` و `DELETE` على جداول العيادة وتحديثات استراحة الطبيب (`settings.clinicStatus`) وتنبيهات الإشعارات (`settings.latestAlert`).
- إطلاق التحديث الفوري للأجهزة الأخرى ومزامنة البيانات في أقل من 200ms.

### خطوة 2: نظام تنبيهات خالي من التكرار مع مرشح للأحداث القديمة
- تحسين `registerAlert` و `previousVisitsMapRef` في `src/App.tsx`.
- حفظ معرفات التنبيهات في `localStorage` (`soli_seen_alerts_v1`) مع الطابع الزمني.
- تجاهل التنبيهات التي تم عرضها مسبقاً، وتجاهل أي حدث عمره أكبر من 5 دقائق عند أول تحميل للصفحة، ومسح السجلات الأقدم من 24 ساعة.

### خطوة 3: تصحيح شاشة المواعيد ودوال معالجة الأخطاء
- تعديل `toArabicError` في `src/services/firestoreWorkflows.ts` لتقديم رسائل عربية دقيقة وتوضيح الأخطاء دون تعميم عبارة "عملية طبية".
- تعديل `handleAddAppointment` في `src/App.tsx` لترجع النتيجة بدقة.
- تعديل `AppointmentsScreen.tsx` لانتظار التأكيد الفعلي من الخادم قبل إظهار رسالة النجاح وتفريغ الحقول.

### خطوة 4: مزامنة الحذف السحابي الشامل بين جميع الأجهزة (Cache Invalidation Epoch)
- تحديث `src/utils/demoDataGenerator.ts` و `src/services/offlineSync.ts` و `src/App.tsx` لتسجيل واستشعار رقم الجيل `dbEpoch` في `settings`، وتفريغ كاش `IndexedDB` لجميع الأجهزة النشطة فور حدوث مسح سحابي.

### خطوة 5: اختبارات PostgreSQL PGlite و التحقق الشامل
- إضافة اختبارات شاملة في `tests/rls-clinic-isolation.test.mjs` و `tests/custom-permissions.test.mjs` للتحقق من:
  1. إنشاء موعد لسكرتيرة بالوضع الافتراضي ومع الصلاحيات المخصصة.
  2. تدفق إشعارات الزيارات وانتهاء الكشف واستراحة الطبيب.
  3. تدفق الحذف السحابي ومزامنة رقم الجيل.
- تشغيل `npm test`، `compile_applet`، و `lint_applet` للتأكد من السلامة التامة للكود.
