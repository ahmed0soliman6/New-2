# إصلاح تعارض دوال الـ RPC (42P13) وتجهيز ملف التأسيس الشامل لقاعدة البيانات (`v3.0.0`)

تهدف هذه الخطة إلى حل خطأ PostgreSQL (`ERROR: 42P13: cannot change return type of existing function`) نهائياً عند تشغيل ملف الترحيل على قاعدة البيانات الحالية، مع توفير ملف SQL شامل ومكتفٍ بذاته لتأسيس وتشغيل النظام بالكامل عند نقله إلى أي مشروع Supabase جديد بخطوة واحدة.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> تم اعتماد اختياراتك التالية لبناء ملفات قاعدة البيانات:
> - **Confirmed Decision 1 (تنظيم ملفات التأسيس)**: إنشاء ملف شامل واحد مكتفٍ بذاته (Self-Contained Master Setup) يضم الجداول، الفهارس، الدوال الأمنية، سياسات RLS المنفصلة، دوال الـ RPC التسع، وتفعيل البث اللحظي (Realtime)، مع تحديث ملف المخطط الأساسي ليبقى متطابقاً معه.
> - **Confirmed Decision 2 (تهيئة العيادة الافتراضية)**: تضمين أمر التهيئة الآمن (`ON CONFLICT DO NOTHING`) لإدراج سجل العيادة الافتراضية (`clinic_main`) والإعدادات الأولية حتى يعمل التطبيق مباشرة بعد تشغيل السكربت دون الحاجة لإدخال يدوي.

---

## 1. Overview & Core Concept

- **What It Does**:
  1. يعالج خطأ `42P13` في PostgreSQL الناتج عن اختلاف نوع الإرجاع (`RETURN TYPE`) للدوال الموجودة مسبقاً في قاعدة البيانات مثل `delete_patient(text, text, text)` و `remove_queue_visit(text, text)` و `add_transaction` و `delete_transaction` و `admin_delete_clinic_user`، وذلك عبر حذف التوقيعات القديمة بأمان (`DROP FUNCTION IF EXISTS ...`) قبل إعادة إنشائها.
  2. يجمع كل أوامر SQL اللازمة لتشغيل نظام العيادة من الصفر في ملف تأسيس واحد شامل ومرتب، بحيث يمكن نسخ المشروع إلى أي حساب أو مشروع Supabase جديد وتشغيله فوراً.
- **Target Audience / Persona**: مدير النظام أو المطور عند تحديث قاعدة البيانات الحالية أو نقل النظام إلى بيئة Supabase جديدة.
- **Key Value**: تشغيل خالٍ من الأخطاء (`Idempotent Execution`) سواء على قاعدة بيانات قديمة تحتوي على دوال سابقة أو على قاعدة بيانات فارغة تماماً.

---

## 2. User Experience & Operational Flow

- **مسار تحديث قاعدة البيانات الحالية (الحل الفوري للخطأ الظاهر في الصورة)**:
  1. يفتح المسؤول محرر SQL في Supabase.
  2. ينسخ ملف الترحيل المحدّث ويشغله.
  3. يقوم السكربت تلقائياً بحذف النسخ القديمة من الدوال التسع عبر `DROP FUNCTION IF EXISTS` بالتوقيعات المطابقة، ثم يعيد إنشاءها بنوع الإرجاع الموحد ويمنح صلاحيات التنفيذ (`GRANT EXECUTE ... TO authenticated`).
- **مسار نقل المشروع إلى قاعدة بيانات Supabase جديدة بالكامل**:
  1. ينشئ المسؤول مشروع Supabase جديداً ويفتح **SQL Editor**.
  2. ينسخ محتوى ملف التأسيس الشامل ويشغله مرة واحدة.
  3. يتم تلقائياً إنشاء الجداول الأساسية + الـ 22 جدولاً تشغيلياً وطبياً + دوال التحقق من الصلاحيات المخصصة + سياسات RLS المنفصلة + دوال الـ RPC التسع + تفعيل `supabase_realtime` + زرع سجل العيادة الافتراضية (`clinic_main`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: إضافة `DROP FUNCTION IF EXISTS` صريحة بالتوقيع الكامل للمعاملات قبل كل `CREATE OR REPLACE FUNCTION`**
  - *Chosen Approach*: وضع أوامر `DROP FUNCTION IF EXISTS` لكل دالة من دوال الـ RPC التسع (بما فيها التوقيعات ذات المعاملات الافتراضية) داخل كتلة المعاملة (`BEGIN ... COMMIT`).
  - *Why*: يمنع PostgreSQL تعديل نوع الإرجاع (`void` مقابل `jsonb`) عبر `CREATE OR REPLACE FUNCTION` ويرفع الخطأ `42P13`. حذف الدالة أولاً داخل نفس المعاملة يضمن استبدالها بأمان دون انقطاع الخدمة.
- **Decision 2: توحيد جميع دوال الـ RPC التسع لتعمل بـ `SECURITY DEFINER` مع `SET search_path = public` وفحص `has_clinic_permission`**
  - *Chosen Approach*: جعل الدوال التسع تتحقق أولاً من `public.is_clinic_member(p_clinic_id)` ومن الصلاحية الدقيقة عبر `public.has_clinic_permission(...)` ثم تنفذ العمليات المركبة ذرياً.
  - *Why*: يضمن أن المستخدم الذي منحه المدير صلاحية مخصصة (مثل سكرتير مُنح صلاحية حذف مريض أو إنهاء كشف) لا يتعطل بسبب صلاحيات الجداول الفرعية المرتبطة، مع بقاء الحماية الخادمية صارمة.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & SQL Execution Pipeline

```
┌──────────────────────────────────────────────────────────────────────────┐
│                 Supabase SQL Setup & Migration Pipeline                  │
└────────────────────────────────────┬─────────────────────────────────────┘
                                     │
         ┌───────────────────────────┴───────────────────────────┐
         ▼                                                       ▼
┌─────────────────────────────────────┐       ┌─────────────────────────────────────┐
│   1. Existing Database Migration    │       │    2. New Database Full Bootstrap   │
│  (Fix 42P13 & Upgrade Permissions)  │       │     (Complete Master SQL Script)    │
└────────────────┬────────────────────┘       └──────────────────┬──────────────────┘
                 │                                               │
                 ├─► DROP FUNCTION IF EXISTS (All 9 RPCs)        ├─► Core Tables (clinics, clinic_members, usernames)
                 ├─► Create/Update has_clinic_permission()       ├─► 22 Clinic Document Tables + Indexes
                 ├─► Drop member_all & Create Granular RLS       ├─► Permission Functions (is_clinic_member, has_clinic_permission)
                 ├─► Recreate 9 Hardened RPC Functions           ├─► Granular RLS Policies (SELECT / INSERT / UPDATE / DELETE)
                 └─► GRANT EXECUTE TO authenticated              ├─► Drop & Create All 9 Atomic RPCs + Grants
                                                                 ├─► Enable Realtime Publication (supabase_realtime)
                                                                 └─► Seed Default Clinic ('clinic_main')
```

### التوقيعات التي سيتم حذفها وإعادة إنشائها لحل خطأ `42P13`
1. `public.delete_patient(text, text, text)` و `public.delete_patient(text, text)`
2. `public.remove_queue_visit(text, text)`
3. `public.add_transaction(text, text, text, jsonb, text, jsonb, text, jsonb)`
4. `public.delete_transaction(text, text, text, text)`
5. `public.admin_delete_clinic_user(text, uuid)`
6. `public.check_in_appointment(text, text, text, text, integer, text, text, text, text, numeric, text, text, jsonb)`
7. `public.register_walk_in(text, text, text, integer, text, jsonb, text, text, text, text, numeric, text, text, text, text, jsonb)`
8. `public.complete_visit(text, text, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)`
9. `public.create_appointment(text, text, text, jsonb, text, jsonb)`
