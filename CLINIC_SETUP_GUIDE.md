# 🏥 دليل تأسيس وتشغيل عيادة جديدة على Supabase
## (Soli Medical v3.0.0 — Multi-Clinic Deployment Guide)

تم تصميم النظام ليعمل بعزل كامل بين العيادات (`clinic_id`) وبدون أي معرّف عيادة افتراضي مكتوب صراحة في الكود (`Zero Hardcoded Clinic Slug`).

---

### 📋 الخطوة 1: تأسيس الجداول والسياسات والدوال في Supabase
1. افتح لوحة تحكم مشروعك في [Supabase Dashboard](https://supabase.com/dashboard).
2. انتقل إلى **SQL Editor** واضغط **New query**.
3. افتح الملف `supabase/full_setup.sql` من المشروع، انسخ محتواه بالكامل، والصقه في المحرر ثم اضغط **Run**.
   *(ملاحظة: إذا كانت الجداول موجودة مسبقاً وتريد فقط تحديث الصلاحيات المخصصة وسياسات RLS وجدول `audit_events` ودوال RPC، شغّل الملف `supabase/migrations/20261107_fix_custom_permissions_rls.sql`).*

---

### 🏷️ الخطوة 2: تسجيل العيادة الجديدة في جدول `clinics`
في **SQL Editor**، نفّذ الأمر التالي لإنشاء سجل العيادة الجديدة باختيار معرّف فريد (`slug`) خاص بها (مثلاً `al-nour-clinic`):

```sql
insert into public.clinics (id, name)
values ('al-nour-clinic', 'عيادة النور التخصصية')
on conflict (id) do update
  set name = excluded.name;
```

---

### ⚙️ الخطوة 3: ضبط متغيرات البيئة (`VITE_CLINIC_SLUG` و `CLINIC_SLUG`)
في ملف `.env.local` (أثناء التطوير) وفي إعدادات البيئة على الخادم (**Vercel > Settings > Environment Variables**)، أضف المتغيرات التالية:

```env
# إعدادات الواجهة الأمامية (Client & Server)
VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
VITE_CLINIC_SLUG="al-nour-clinic"
CLINIC_SLUG="al-nour-clinic"
VITE_INTERNAL_EMAIL_DOMAIN="auth.solimedical.local"

# إعدادات الخادم فقط (Server-Only — لا تضف بادئة VITE_ أبداً)
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
```

> ⚠️ **تنبيه هام**: لن يعمل الاتصال بقاعدة البيانات أو مسارات إدارة المستخدمين (`/api/users/*`) إذا لم يتم ضبط `VITE_CLINIC_SLUG` (أو `CLINIC_SLUG`)، وسيُظهر النظام رسالة خطأ واضحة بالعربية تطالب بضبطه.

---

### 👤 الخطوة 4: إنشاء أول حساب مدير (`admin`) للعيادة
1. من لوحة تحكم Supabase، اذهب إلى **Authentication > Users** واضغط **Add user > Create new user**:
   - **Email**: `admin@auth.solimedical.local` (أو أي اسم مستخدم متبوع بنطاق `VITE_INTERNAL_EMAIL_DOMAIN`).
   - **Password**: اختر كلمة مرور قوية (8 خانات على الأقل).
   - فعّل خيار **Auto Confirm User** ثم اضغط **Create user**.
2. انسخ معرّف المستخدم (`User UID`) الذي تم إنشاؤه، ثم نفّذ الاستعلام التالي في **SQL Editor** لربطه كمدير (`admin`) للعيادة:

```sql
-- استبدل القيم التالية بمعرّف المستخدم (UUID) ومعرّف العيادة (slug)
do $$
declare
  v_admin_uid uuid := '00000000-0000-0000-0000-000000000000'; -- ضع User UID هنا
  v_clinic_id text := 'al-nour-clinic';                        -- ضع VITE_CLINIC_SLUG هنا
  v_username  text := 'admin';
begin
  insert into public.usernames (username_lower, user_id)
  values (lower(v_username), v_admin_uid)
  on conflict (username_lower) do update
    set user_id = excluded.user_id;

  insert into public.clinic_members (clinic_id, user_id, role, is_active, permissions)
  values (
    v_clinic_id,
    v_admin_uid,
    'admin',
    true,
    jsonb_build_object(
      'username', lower(v_username),
      'displayName', 'مدير النظام',
      'email', lower(v_username) || '@auth.solimedical.local',
      'updatedAt', now()
    )
  )
  on conflict (clinic_id, user_id) do update
    set role = 'admin',
        is_active = true;
end $$;
```

3. افتح التطبيق وسجّل الدخول باسم المستخدم `admin` وكلمة المرور التي اخترتها، ومن شاشة **الإعدادات > إدارة المستخدمين والصلاحيات** يمكنك إضافة الأطباء والسكرتارية وتخصيص صلاحيات كل مستخدم بدقة.

---

### 🛡️ الخطوة 5: الصيانة والتنظيف الدوري لسجل المراجعة الأمني (`audit_events`)
جدول `public.audit_events` محمي بـ Trigger (`trg_audit_events_immutable`) يمنع أي عملية `UPDATE` أو `DELETE` حتى من دوال `SECURITY DEFINER` أو حسابات المديرين لضمان عدم التلاعب بالسجل الجنائي.

عند رغبة مالك قاعدة البيانات (Database Owner) في أرشفة أو حذف السجلات الأقدم من سنة واحدة يدوياً، يمكنه تشغيل الأمر التالي من داخل **Supabase SQL Editor** فقط:

```sql
begin;
-- 1. إيقاف الـ Trigger مؤقتاً داخل المعاملة الحالية فقط (صلاحية مالك القاعدة)
alter table public.audit_events disable trigger trg_audit_events_immutable;

-- 2. حذف سجلات المراجعة الأقدم من 365 يوماً
delete from public.audit_events
 where created_at < now() - interval '365 days';

-- 3. إعادة تفعيل الـ Trigger فوراً قبل إنهاء المعاملة
alter table public.audit_events enable trigger trg_audit_events_immutable;
commit;
```
