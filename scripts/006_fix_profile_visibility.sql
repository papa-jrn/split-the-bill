-- Finalize profile visibility so users can read each other's profile
-- when they share a group.

drop policy if exists "profiles_select_group_members" on public.profiles;

create policy "profiles_select_group_members"
on public.profiles
for select
using (
  exists (
    select 1
    from public.group_members gm_target
    join public.group_members gm_me
      on gm_me.group_id = gm_target.group_id
    where gm_target.user_id = public.profiles.id
      and gm_me.user_id = auth.uid()
  )
);
