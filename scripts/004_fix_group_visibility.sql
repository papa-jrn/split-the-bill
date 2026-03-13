-- Allow group creators to read the group row immediately after insert,
-- before the follow-up group_members row is queried back through RLS.

drop policy if exists "groups_select_member" on public.groups;

create policy "groups_select_member"
on public.groups
for select
using (
  created_by = auth.uid()
  or public.is_group_member(id, auth.uid())
);
