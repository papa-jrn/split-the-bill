-- Track member-to-member payment confirmations before recording a settlement.

create table if not exists public.group_payments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  paid_marked_at timestamptz not null default now(),
  confirmed_at timestamptz,
  check (from_user_id <> to_user_id)
);

alter table public.group_payments enable row level security;

create unique index if not exists group_payments_pending_unique
  on public.group_payments (group_id, from_user_id, to_user_id, amount_cents)
  where status = 'pending';

drop policy if exists "group_payments_select_member" on public.group_payments;
drop policy if exists "group_payments_insert_debtor" on public.group_payments;
drop policy if exists "group_payments_update_recipient" on public.group_payments;

create policy "group_payments_select_member"
on public.group_payments
for select
using (public.is_group_member(group_id, auth.uid()));

create policy "group_payments_insert_debtor"
on public.group_payments
for insert
with check (
  status = 'pending'
  and created_by = auth.uid()
  and from_user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
  and public.is_group_member(group_id, to_user_id)
);

create policy "group_payments_update_recipient"
on public.group_payments
for update
using (
  status = 'pending'
  and to_user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
)
with check (
  status = 'completed'
  and to_user_id = auth.uid()
  and public.is_group_member(group_id, auth.uid())
  and confirmed_at is not null
);
