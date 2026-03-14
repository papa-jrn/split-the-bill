-- Add a simple message board for each group.

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0),
  created_at timestamptz default now()
);

alter table public.group_messages enable row level security;

drop policy if exists "group_messages_select_member" on public.group_messages;
drop policy if exists "group_messages_insert_member" on public.group_messages;
drop policy if exists "group_messages_delete_author" on public.group_messages;

create policy "group_messages_select_member"
on public.group_messages
for select
using (public.is_group_member(group_id, auth.uid()));

create policy "group_messages_insert_member"
on public.group_messages
for insert
with check (
  public.is_group_member(group_id, auth.uid())
  and user_id = auth.uid()
);

create policy "group_messages_delete_author"
on public.group_messages
for delete
using (user_id = auth.uid());
