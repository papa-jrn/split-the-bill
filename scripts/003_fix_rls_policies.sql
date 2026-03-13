-- Replace recursive RLS policies with helper-function-based policies.

create or replace function public.is_group_member(check_group_id uuid, check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = check_group_id
      and user_id = check_user_id
  );
$$;

create or replace function public.is_group_admin(check_group_id uuid, check_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members
    where group_id = check_group_id
      and user_id = check_user_id
      and role = 'admin'
  );
$$;

grant execute on function public.is_group_member(uuid, uuid) to authenticated;
grant execute on function public.is_group_admin(uuid, uuid) to authenticated;

drop policy if exists "groups_select_member" on public.groups;
drop policy if exists "groups_update_admin" on public.groups;
drop policy if exists "groups_delete_admin" on public.groups;

drop policy if exists "group_members_select" on public.group_members;
drop policy if exists "group_members_insert_admin" on public.group_members;
drop policy if exists "group_members_delete_admin" on public.group_members;

drop policy if exists "group_invites_select_admin" on public.group_invites;
drop policy if exists "group_invites_insert_admin" on public.group_invites;
drop policy if exists "group_invites_delete" on public.group_invites;

drop policy if exists "expenses_select_member" on public.expenses;
drop policy if exists "expenses_insert_member" on public.expenses;

drop policy if exists "expense_splits_select" on public.expense_splits;
drop policy if exists "profiles_select_group_members" on public.profiles;

create policy "groups_select_member"
on public.groups
for select
using (public.is_group_member(id, auth.uid()));

create policy "groups_update_admin"
on public.groups
for update
using (public.is_group_admin(id, auth.uid()));

create policy "groups_delete_admin"
on public.groups
for delete
using (public.is_group_admin(id, auth.uid()));

create policy "group_members_select"
on public.group_members
for select
using (public.is_group_member(group_id, auth.uid()));

create policy "group_members_insert_admin"
on public.group_members
for insert
with check (
  public.is_group_admin(group_id, auth.uid())
  or user_id = auth.uid()
);

create policy "group_members_delete_admin"
on public.group_members
for delete
using (
  public.is_group_admin(group_id, auth.uid())
  or user_id = auth.uid()
);

create policy "group_invites_select_admin"
on public.group_invites
for select
using (public.is_group_admin(group_id, auth.uid()));

create policy "group_invites_insert_admin"
on public.group_invites
for insert
with check (public.is_group_admin(group_id, auth.uid()));

create policy "group_invites_delete"
on public.group_invites
for delete
using (
  public.is_group_admin(group_id, auth.uid())
  or email in (select email from public.profiles where id = auth.uid())
);

create policy "expenses_select_member"
on public.expenses
for select
using (public.is_group_member(group_id, auth.uid()));

create policy "expenses_insert_member"
on public.expenses
for insert
with check (
  public.is_group_member(group_id, auth.uid())
  and auth.uid() = created_by
);

create policy "expense_splits_select"
on public.expense_splits
for select
using (
  exists (
    select 1
    from public.expenses e
    where e.id = expense_id
      and public.is_group_member(e.group_id, auth.uid())
  )
);

create policy "profiles_select_group_members"
on public.profiles
for select
using (
  exists (
    select 1
    from public.group_members gm
    where gm.user_id = id
      and public.is_group_member(gm.group_id, auth.uid())
  )
);
