# خطة نقل Soli Medical من Firebase إلى Supabase

## ما وجدته في الملف المرفوع
- تطبيق Vite + React + TypeScript.
- نحو 32 ملفاً يستورد من `firebase/firestore`، بالإضافة إلى `firebase/auth` و`firebase/app`.
- `src/services/auth.ts` (280 سطراً) و`src/context/AuthContext.tsx` (288 سطراً) يعتمدان على تسجيل دخول Firebase وأسماء المستخدمين.
- `src/services/firestoreWorkflows.ts` (451 سطراً) يحتوي منطق الحجوزات والفواتير والمعاملات.
- `firestore.rules` (499 سطراً) هي قواعد الأمان الحالية، وتُعاد كتابتها كسياسات RLS في Postgres.
- `api/users/delete.ts` (389 سطراً) يستخدم `firebase-admin` لحذف المستخدمين، ويُستبدل بـ Supabase Admin API.
- ملفات الإعداد والتوثيق الخاصة بـ Firebase (`firebase.json`، `.firebaserc`، `firestore.indexes.json`، `firebase-blueprint.json`، `FIREBASE_SETUP.md`، وغيرها) تُحذف بعد النقل.

## الاستراتيجية
نموذج "مستند JSON داخل جدول" لكل مجموعة (Collection)، وكل جدول يحمل `clinic_id`. هذا يقلل تغيير منطق الواجهة، لأن الكود يتعامل مع كائنات كما يفعل مع Firestore تقريباً. يمكن تحويل أعمدة محددة إلى أعمدة حقيقية لاحقاً عند الحاجة للاستعلامات الثقيلة.

## المراحل
1. **المصادقة:** استبدال Firebase Auth بـ Supabase Auth، مع جدول `usernames` لتسجيل الدخول باسم المستخدم.
2. **طبقة البيانات:** استبدال `repositories` و`firestoreWorkflows` بعميل Supabase، مع الحفاظ على واجهات الدوال نفسها حتى لا تتأثر الشاشات.
3. **المزامنة والأوفلاين:** الإبقاء على التخزين المحلي، والمزامنة عبر `updated_at` بدلاً من `onSnapshot`. هذا أيضاً يخفض عدد القراءات.
4. **الحذف والإدارة:** نقل `api/users/delete.ts` إلى Supabase Admin API.
5. **القواعد:** التحقق بمستخدمين من عيادتين مختلفتين أن كل بيانات عيادة محجوبة عن الأخرى.
6. **التنظيف:** حذف ملفات Firebase وحزمه `firebase` و`firebase-admin` و`firebase-tools` من `package.json`.

## متغيرات البيئة الجديدة
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLINIC_SLUG=
```
المفتاح `service_role` يوضع فقط في متغيرات الخادم (Vercel بدون بادئة VITE_)، ولا يدخل أي ملف في المستودع.

## ما لم أنفذه بعد
- لم أعدّل كود التطبيق نفسه في هذه الخطوة، لأن النقل الكامل يحتاج تعديل نحو 32 ملفاً وإعادة اختبار كل شاشة، وهذا عمل مرحلي ولا يصح تنفيذه دون اختبار.
- لم أنشئ حساب Supabase، فهذا يتم من حسابك الشخصي.
- لم أدفع الكود إلى GitHub، فهذا يتم منك كما اتفقنا.
