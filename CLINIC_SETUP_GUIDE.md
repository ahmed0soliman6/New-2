# 🏥 دليل تشغيل وبيع النظام لعيادة جديدة في 3 دقائق
## (White-Label Quick Deployment Guide)

تم تصميم هذا النظام ليكون **مستقلاً تماماً وبدون أي قيم ثابتة مشفرة في الكود (Zero Hardcoded Secrets)**.
كل ما تحتاجه لتشغيل نسخة جديدة لعيادة جديدة هو **إنشاء مشروع Firebase جديد ووضع متغيرات الربط في Vercel**.

---

### 📋 الخطوة 1: إنشاء مشروع Firebase جديد للعيادة (دقيقة واحدة)
1. افتح [Firebase Console](https://console.firebase.google.com/) واضغط **Add project** واكتب اسم العيادة الجديدة (مثلاً: `clinic-nour`).
2. **تفعيل المصادقة (Authentication)**:
   - اذهب إلى **Build > Authentication** واضغط **Get started**.
   - من تبويب **Sign-in method**، فعّل خيار **Email/Password** واحفظ.
3. **تفعيل قاعدة البيانات (Cloud Firestore)**:
   - اذهب إلى **Build > Firestore Database** واضغط **Create database**.
   - اختر المنطقة (مثلاً: `europe-west3` أو أقرب منطقة للعيادة).
   - ابدأ بوضع **Production mode**.
4. **نسخ قواعد الحماية (Firestore Rules)**:
   - افتح ملف `firestore.rules` الموجود في المشروع وانسخ محتواه بالكامل.
   - في Firebase Console > **Firestore Database** > تبويب **Rules**، الصق الكود واضغط **Publish**.

---

### 🔑 الخطوة 2: نسخ بيانات الربط إلى Vercel (دقيقة واحدة)
1. في Firebase Console، اضغط على أيقونة الترس ⚙️ بجانب **Project Overview** واختر **Project settings**.
2. في تبويب **General** تحت قسم **Your apps**، اضغط على أيقونة الويب `</>` وسجل تطبيق ويب.
3. ستظهر لك القيم المخصصة للعيادة، انسخها إلى **Vercel > Settings > Environment Variables** (مع تحديد كل البيئات: **Production** و **Preview** و **Development**):
   ```env
   VITE_FIREBASE_API_KEY="AIzaSy..."
   VITE_FIREBASE_AUTH_DOMAIN="clinic-nour.firebaseapp.com"
   VITE_FIREBASE_PROJECT_ID="clinic-nour"
   VITE_FIREBASE_STORAGE_BUCKET="clinic-nour.firebasestorage.app"
   VITE_FIREBASE_MESSAGING_SENDER_ID="123456789"
   VITE_FIREBASE_APP_ID="1:123456789:web:abcdef"
   ```

---

### 🛡️ الخطوة 3: تفعيل الحذف التلقائي للمستخدمين (اختياري - 30 ثانية)
لحذف المستخدمين من صفحة Authentication تلقائياً عند حذفهم من لوحة إدارة المستخدمين:
1. في Firebase Console > **Project settings** > تبويب **Service accounts**.
2. اضغط **Generate new private key** (سيتم تحميل ملف JSON).
3. في Vercel، أضف متغيرين (مع تحديد Production و Preview):
   - `FIREBASE_CLIENT_EMAIL`: الإيميل الموجود في الملف (ينتهي بـ `iam.gserviceaccount.com`).
   - `FIREBASE_PRIVATE_KEY`: المفتاح الخاص الموجود في الملف (بين علامتي تنصيص).
   *(أو يمكنك ببساطة نسخ كود ملف JSON بالكامل ووضعه في متغير واحد اسمه `FIREBASE_SERVICE_ACCOUNT`)*.

---

### 🚀 الخطوة 4: تشغيل النظام وتسجيل الدخول الأولي (Auto-Provisioning)
1. افتح رابط المشروع في المتصفح.
2. سجّل الدخول بالحساب الافتراضي المبرمج في النظام:
   - **اسم المستخدم**: `admin`
   - **كلمة المرور**: `admin1234`
3. يقوم النظام تلقائياً في أول تسجيل دخول بإنشاء حساب المدير في Firebase Authentication وتثبيت صلاحيات الإدارة الكاملة في Firestore!
4. من داخل النظام:
   - اذهب إلى **الإعدادات (Settings)** لتغيير كلمة مرور المدير وتعيين أسئلة الاسترداد.
   - خصص اسم الطبيب، التخصص، الفروع، الخدمات، والأسعار الخاصة بالعيادة مباشرة من الواجهة ودون الحاجة لتعديل أي سطر برمجي.

---

### 💡 ملخص التكرار للعيادات القادمة:
- انسخ الكود (أو اربط نفس مستودع GitHub بمشروع جديد في Vercel).
- ضع المتغيرات الـ 6 الخاصة بالعيادة.
- انشر المشروع (`Redeploy`) — سيعمل النظام بقاعدة بيانات منفصلة تماماً ومستقلة 100%!
