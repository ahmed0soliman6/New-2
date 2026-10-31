# تقرير ربط Firebase وFirestore

## الحالة العامة

تم ربط التطبيق بطبقة Firebase Authentication وFirestore مع الحفاظ على الواجهة الحالية. عند توفير إعدادات Firebase الصحيحة، يصبح Firestore مصدر البيانات المشترك للمجموعات التشغيلية، وتعمل المعاملات الذرية والمزامنة الفورية بين الأجهزة. لم يتم اختبار اتصال حي بعد لأن إعدادات مشروع Firebase غير موجودة في بيئة المشروع.

## Collections المستخدمة

| Collection | الاستخدام |
|---|---|
| `users` | حسابات المستخدمين والأدوار (`DOCTOR` و`RECEPTIONIST`) |
| `patients` | السجل الأساسي المركزي للمريض بمعرف ثابت |
| `appointments` | المواعيد المرتبطة بـ `patientId` و`clinicLocationId` |
| `visits` | الزيارات وحالات الانتظار والكشف |
| `invoices` | الفواتير المرتبطة بالزيارة |
| `payments` | عمليات التحصيل المرتبطة بالفاتورة والزيارة |

لم تتم إضافة Collections غير مستخدمة مثل الإشعارات أو العيادات إلى مسار التشغيل؛ يمكن إضافتها عندما تصبح مطلوبة فعليًا. بيانات الكتالوج والإعدادات الحالية ما زالت preview/local لأنها لم تُربط في الواجهة الحالية بعملية حفظ مشتركة.

## Data layer

تم فصل الوصول إلى Firebase في الملفات التالية:

- `src/services/firebase.ts`: تهيئة Firebase وFirestore offline cache.
- `src/services/auth.ts`: التسجيل وتسجيل الدخول وتسجيل الخروج.
- `src/services/firestoreWorkflows.ts`: المعاملات الذرية.
- `src/services/repositories.ts`: listeners موحدة لـ `patients`, `appointments`, `visits`, `invoices`, `payments`.

## Transactions

تستخدم المعاملات في إنشاء الموعد، تسجيل حضور الموعد، تسجيل walk-in، بدء الكشف، وإنهاء الكشف. تسجيل الحضور يكتب تحديث الموعد والفاتورة والدفع والزيارة في معاملة واحدة. تسجيل walk-in يكتب Patient وInvoice وPayment وVisit في معاملة واحدة. فشل أي خطوة يمنع نشر زيارة انتظار ناقصة.

## Realtime synchronization

يتم تشغيل `onSnapshot` للمجموعات الرئيسية بعد تسجيل الدخول. يقوم التطبيق بتحديث حالة React عند كل تغيير من أي جهاز، ويتم إلغاء جميع الاشتراكات عند إزالة التطبيق لتجنب Memory Leaks أو listeners مكررة.

## Patient synchronization

لكل Patient معرف ثابت. عند إنشاء موعد، يتم البحث عن المريض بالاسم أو الهاتف محليًا قبل الإنشاء، ثم تحفظ Patient وAppointment في transaction واحدة. تحديثات Firestore تصل إلى جميع الأجهزة عبر listener المرضى.

## Visit and Queue synchronization

الـ Queue مشتقة من `visits` ذات الحالة `WAITING`. تسجيل زيارة ناجح يكتب الزيارة في Firestore، وتظهر للطبيب عبر listener الزيارات. تغيير الطبيب لحالة الزيارة إلى `IN_PROGRESS` أو `COMPLETED` يتم في transaction، ثم يصل التغيير مباشرة إلى أجهزة المستخدمين.

## Appointment synchronization

إنشاء الموعد يكتب `Appointment` حقيقيًا إلى Firestore بدل الاعتماد على نسخة محلية فقط. listener المواعيد يحدّث قائمة المواعيد في كل جلسة متصلة.

## Authentication

تمت إضافة شاشة تسجيل دخول وإنشاء حساب. الحساب الأول ينشأ بدور `DOCTOR`، ويُحفظ ملف المستخدم في `users/{firebaseUid}` بعد نجاح Firebase Authentication. كلمات المرور لا تحفظ في Firestore.

## Offline / Online

تم تفعيل `persistentLocalCache` مع `persistentMultipleTabManager`. البيانات التي سبق تحميلها تظل قابلة للعرض عند انقطاع مؤقت، ويقوم Firebase بمزامنة الكتابات المعلقة عند عودة الاتصال. المعاملات الفاشلة تعرض رسالة للمستخدم ولا تنشئ سجلًا ناقصًا.

## Security Rules

القواعد في `firestore.rules` تتطلب مستخدمًا مسجلًا. يسمح إنشاء حساب ذاتي بدور الطبيب فقط، بينما تعديلات المستخدمين والحذف والعمليات السريرية الحساسة محكومة بدور الطبيب. القراءة والعمليات التشغيلية المعتادة متاحة للمستخدم المسجل بما يتوافق مع تدفق الاستقبال والطبيب.

## Preview data and local state

تم الإبقاء على preview fixtures للحفاظ على شكل الواجهة، لكنها ليست مصدر Firestore. لا يوجد استخدام لـ `localStorage` أو `sessionStorage` أو IndexedDB في المشروع. عند توفر Firebase، تستبدل listeners الحالة التشغيلية المحلية بالبيانات القادمة من Firestore.

## الاختبارات

`npm run lint` و`npm run build` يمران بنجاح. اختبارات الجهازين الفعلية لا يمكن تنفيذها قبل إضافة Firebase configuration وتشغيل Authentication وFirestore في مشروع حقيقي. بعد ذلك يجب اختبار تسجيل مريض، تسجيل زيارة، تغيير حالة الزيارة، إنشاء موعد، تعديل مريض، وانقطاع الاتصال.

## المطلوب لإكمال التفعيل الفعلي

إضافة قيم Firebase Web App إلى متغيرات `VITE_FIREBASE_*` كما هو موضح في `FIREBASE_SETUP.md`، تفعيل Email/Password، وإنشاء Firestore Database ثم نشر `firestore.rules`. بعد ذلك يمكن إنشاء حساب المستخدم من شاشة التسجيل دون إرسال كلمة المرور في المحادثة.
