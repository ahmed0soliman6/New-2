-- Soli Medical: Atomic Admin Delete Clinic User RPC
-- Tables affected atomically: clinic_members, usernames
-- Do NOT execute automatically on production; review and run in Supabase SQL Editor.

drop function if exists public.admin_delete_clinic_user(text, uuid) cascade;

create or replace function public.admin_delete_clinic_user(
  p_clinic_id text,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exists boolean;
begin
  if not public.is_clinic_member(p_clinic_id) then
    raise exception 'Unauthorized: caller is not an active member of clinic %', p_clinic_id;
  end if;

  if not (
    public.has_clinic_permission(p_clinic_id, 'users.manage', 'delete')
    or public.has_clinic_permission(p_clinic_id, 'system-settings', 'delete')
  ) then
    raise exception 'Unauthorized: caller lacks users.manage permission';
  end if;

  if p_user_id is null then
    raise exception 'Invalid input: p_user_id is required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot delete your own active account';
  end if;

  select exists(
    select 1 from public.clinic_members
     where clinic_id = p_clinic_id
       and user_id = p_user_id
  ) into v_exists;

  if not v_exists then
    raise exception 'User is not a member of this clinic';
  end if;

  delete from public.clinic_members
   where clinic_id = p_clinic_id
     and user_id = p_user_id;

  -- If user has no remaining memberships in any clinic, clean up usernames mapping
  if not exists (select 1 from public.clinic_members where user_id = p_user_id) then
    delete from public.usernames where user_id = p_user_id;
  end if;
end;
$$;

revoke execute on function public.admin_delete_clinic_user(text, uuid) from public, anon;
grant execute on function public.admin_delete_clinic_user(text, uuid) to authenticated;
