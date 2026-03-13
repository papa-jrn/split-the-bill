-- Backfill profiles for users created before the auth trigger existed
-- and ensure each group creator is also a member/admin of their groups.

insert into public.profiles (id, email, display_name)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data ->> 'display_name', split_part(u.email, '@', 1))
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);

insert into public.group_members (group_id, user_id, role)
select
  g.id,
  g.created_by,
  'admin'
from public.groups g
where not exists (
  select 1
  from public.group_members gm
  where gm.group_id = g.id
    and gm.user_id = g.created_by
);
