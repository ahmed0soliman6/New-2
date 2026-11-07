# Soli Medical Clinic Management System (v3.0.0)

نظام إدارة العيادات الطبية المتكامل المبني باستخدام **React 19 + TypeScript + Vite + Supabase (PostgreSQL & RLS)**.

---

## 🚀 إعداد وتشغيل عيادة جديدة (Quick Start)

لا يحتوي النظام على أي معرّف عيادة افتراضي مكتوب صراحة في الكود؛ يجب ضبط معرّف العيادة عبر متغير البيئة `VITE_CLINIC_SLUG`.

### 1. تهيئة قاعدة البيانات في Supabase
- افتح **Supabase SQL Editor** وشغّل الملف الشامل:
  - `supabase/full_setup.sql` (عند تأسيس قاعدة بيانات جديدة بالكامل).
  - أو `supabase/migrations/20261107_fix_custom_permissions_rls.sql` (لترقية قاعدة بيانات قائمة).

### 2. إنشاء سجل العيادة في جدول `clinics`
```sql
insert into public.clinics (id, name)
values ('my-clinic-slug', 'اسم العيادة')
on conflict (id) do update set name = excluded.name;
```

### 3. ضبط متغيرات البيئة (`.env.local` / Vercel)
انسخ `.env.example` إلى `.env.local` واضبط المتغيرات الإلزامية:
```env
VITE_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
VITE_CLINIC_SLUG="my-clinic-slug"
CLINIC_SLUG="my-clinic-slug"
VITE_INTERNAL_EMAIL_DOMAIN="auth.solimedical.local"
SUPABASE_SERVICE_ROLE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"
```

### 4. إنشاء أول مستخدم مدير (`admin`)
1. أنشئ مستخدماً في **Supabase Authentication > Users** بالبريد `admin@auth.solimedical.local` مع تفعيل **Auto Confirm User**.
2. اربط معرّف المستخدم (`UUID`) بالعيادة في **SQL Editor**:
```sql
insert into public.usernames (username_lower, user_id)
values ('admin', 'PUT-USER-UUID-HERE')
on conflict (username_lower) do update set user_id = excluded.user_id;

insert into public.clinic_members (clinic_id, user_id, role, is_active, permissions)
values (
  'my-clinic-slug',
  'PUT-USER-UUID-HERE',
  'admin',
  true,
  '{"username": "admin", "displayName": "مدير النظام"}'::jsonb
)
on conflict (clinic_id, user_id) do update set role = 'admin', is_active = true;
```

للمزيد من التفاصيل راجع ملف [CLINIC_SETUP_GUIDE.md](./CLINIC_SETUP_GUIDE.md).

---

## 🧪 أوامر الفحص والاختبار
```bash
npm run lint    # فحص أنواع TypeScript
npm run build   # بناء حزمة الإنتاج
npm test        # تشغيل اختبارات الصلاحيات، المزامنة، ومحرك PostgreSQL الفعلي (RLS & RPC)
```
