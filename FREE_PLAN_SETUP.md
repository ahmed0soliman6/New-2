# إعداد Soli Medical على خطة Firebase المجانية

هذه النسخة لا تستخدم Cloud Functions ولا Firebase Admin SDK ولا أي خدمة تتطلب خطة Blaze. التشغيل يعتمد فقط على:

- Firebase Authentication: Email/Password داخليًا مع واجهة Username.
- Cloud Firestore.
- Firestore Transactions.
- Firestore realtime listeners.
- Firestore offline persistence.

## النشر

من Firebase Console استخدم تبويب Firestore → Rules والصق محتوى `firestore.rules` ثم اضغط Publish. لا تنشر Cloud Functions لأن هذه النسخة لا تحتوي عليها.

فعّل من Authentication → Sign-in method خيار Email/Password.

## أول حساب

عند فتح التطبيق لأول مرة تظهر شاشة Initial Admin Setup. ينشئ النظام مستخدم Firebase ثم يكتب `users/{uid}` و`usernames/{usernameLower}` و`_system/bootstrap` داخل Firestore Transaction واحدة.

بعد اكتمال bootstrap، لا تسمح القواعد بإنشاء ADMIN آخر من العميل.

> على الخطة المجانية لا توجد Cloud Function موثوقة لحماية bootstrap من مستخدمين مجهولين في نفس اللحظة. لذلك يجب على مالك المشروع تنفيذ Initial Admin Setup مباشرة بعد نشر القواعد، وعدم مشاركة رابط التطبيق قبل إنشاء المدير الأول.

## حدود الخطة المجانية

لا يوجد في هذه النسخة:

- Cloud Functions.
- Firebase Admin SDK.
- تغيير كلمة مرور مستخدم آخر من ADMIN.
- Recovery Code يعتمد على Backend.
- Service Account key.

كلمة المرور تظل داخل Firebase Authentication ولا تُحفظ في Firestore.
