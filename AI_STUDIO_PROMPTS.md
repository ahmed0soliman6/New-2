# برومبتات Google AI Studio بالترتيب
ألصق كل برومبت بعد أن ينتهي السابق واختبر النتيجة قبل الانتقال للتالي.
ابدأ بإرفاق مجلد المشروع ومعه ملف `supabase/schema.sql` و`MIGRATION_PLAN.md`.

## 1. الفهم والتحقق
"اقرأ MIGRATION_PLAN.md وschema.sql. لا تعدّل أي ملف بعد. اعرض لي قائمة الملفات التي تستورد من firebase مع عدد الأسطر في كل ملف، ثم اقترح ترتيب التعديل."

## 2. إعداد العميل
"أنشئ src/services/supabase.ts يقرأ VITE_SUPABASE_URL وVITE_SUPABASE_ANON_KEY، ويصدّر عميلاً واحداً. أزل src/services/firebase/config.ts وsrc/services/firebase.ts بعد أن تتأكد أن لا ملف آخر يستوردهما. أضف @supabase/supabase-js وأزل firebase من package.json."

## 3. المصادقة
"استبدل src/services/auth.ts وsrc/context/AuthContext.tsx بـ Supabase Auth. تسجيل الدخول باسم المستخدم يتم عبر جدول usernames ثم signInWithPassword بالبريد الداخلي المرتبط بالمستخدم. حافظ على أسماء الدوال المُصدَّرة كما هي حتى لا تتأثر الشاشات. اعرض الفرق قبل الكتابة."

## 4. طبقة البيانات
"استبدل منطق Firestore في src/services/repositories/*.ts وsrc/services/firestoreWorkflows.ts بعمليات على جداول Supabase. كل استعلام يضيف .eq('clinic_id', CLINIC_ID). استخدم data (jsonb) للكائن الكامل، واستخدم updated_at للمزامنة التدريجية بدلاً من onSnapshot. احتفظ بكل واجهة دوال كما هي."

## 5. المزامنة والأوفلاين
"احتفظ بالتخزين المحلي (IndexedDB) للعمل دون اتصال. عند الاتصال، أرسل التغييرات المحلية إلى Supabase واسحب السجلات التي updated_at فيها أحدث من آخر مزامنة. لا تستخدم قنوات Realtime في هذه المرحلة."

## 6. حذف المستخدمين
"حوّل api/users/delete.ts من firebase-admin إلى Supabase Admin API باستخدام SUPABASE_SERVICE_ROLE_KEY من متغيرات الخادم فقط. تأكد أن المفتاح لا يُستورد في أي ملف من src."

## 7. الشاشات والمكونات
"ابحث عن أي استيراد متبقٍ من firebase في src واستبدله. اعرض قائمة قبل التعديل. لا تغيّر أي تصميم أو نص عربي."

## 8. الاختبار
"أضف اختباراً يتحقق أن مستخدماً من عيادة A لا يقرأ بيانات عيادة B عبر Supabase. اكتب التعليمات لتشغيله."

## 9. التنظيف
"احذف firebase.json وfirebase-blueprint.json وfirestore.rules وfirestore.indexes.json وFIREBASE_SETUP.md وFIRESTORE_INTEGRATION_REPORT.md وtests/rules.test.mjs. حدّث .env.example بمتغيرات Supabase. اعرض قائمة الحذف قبل التنفيذ."

## قواعد عامة لكل برومبت
- لا تغيّر تصميم الواجهة أو النصوص العربية.
- لا تضع service_role في أي ملف يُرسل للمتصفح.
- بعد كل مرحلة، شغّل npm run build وأرسل لي الخطأ إن وُجد.
