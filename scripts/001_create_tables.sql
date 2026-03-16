-- Create profiles table (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Create groups table
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.groups enable row level security;

-- Create group_members table (junction table)
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz default now(),
  unique(group_id, user_id)
);

alter table public.group_members enable row level security;

-- Create group_invites table for pending invitations
create table if not exists public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  email text not null,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(group_id, email)
);

alter table public.group_invites enable row level security;

-- Create expenses table (amounts in cents)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  description text not null,
  amount_cents integer not null check (amount_cents > 0),
  paid_by uuid not null references auth.users(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  expense_date date default current_date,
  created_at timestamptz default now()
);

alter table public.expenses enable row level security;

-- Create expense_splits table (how expense is split among members)
create table if not exists public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  unique(expense_id, user_id)
);

alter table public.expense_splits enable row level security;

-- RLS Policies for groups
drop policy if exists "groups_select_member" on public.groups;
drop policy if exists "groups_insert_authenticated" on public.groups;
drop policy if exists "groups_update_admin" on public.groups;
drop policy if exists "groups_delete_admin" on public.groups;

create policy "groups_select_member" on public.groups for select using (
  id in (select group_id from public.group_members where user_id = auth.uid())
);

create policy "groups_insert_authenticated" on public.groups for insert 
  with check (auth.uid() = created_by);

create policy "groups_update_admin" on public.groups for update using (
  id in (select group_id from public.group_members where user_id = auth.uid() and role = 'admin')
);

create policy "groups_delete_admin" on public.groups for delete using (
  id in (select group_id from public.group_members where user_id = auth.uid() and role = 'admin')
);

-- RLS Policies for group_members
drop policy if exists "group_members_select" on public.group_members;
drop policy if exists "group_members_insert_admin" on public.group_members;
drop policy if exists "group_members_delete_admin" on public.group_members;

create policy "group_members_select" on public.group_members for select using (
  group_id in (select group_id from public.group_members where user_id = auth.uid())
);

create policy "group_members_insert_admin" on public.group_members for insert with check (
  group_id in (select group_id from public.group_members where user_id = auth.uid() and role = 'admin')
  or (user_id = auth.uid()) -- Allow self-join for accepting invites
);

create policy "group_members_delete_admin" on public.group_members for delete using (
  group_id in (select group_id from public.group_members where user_id = auth.uid() and role = 'admin')
  or user_id = auth.uid() -- Allow self-removal
);

-- Allow users to see profiles of people in their groups
drop policy if exists "profiles_select_group_members" on public.profiles;

create policy "profiles_select_group_members" on public.profiles for select using (
  id in (
    select gm2.user_id from public.group_members gm1
    join public.group_members gm2 on gm1.group_id = gm2.group_id
    where gm1.user_id = auth.uid()
  )
);

-- RLS Policies for group_invites
drop policy if exists "group_invites_select_admin" on public.group_invites;
drop policy if exists "group_invites_select_invitee" on public.group_invites;
drop policy if exists "group_invites_insert_admin" on public.group_invites;
drop policy if exists "group_invites_delete" on public.group_invites;

create policy "group_invites_select_admin" on public.group_invites for select using (
  group_id in (select group_id from public.group_members where user_id = auth.uid() and role = 'admin')
);

create policy "group_invites_select_invitee" on public.group_invites for select using (
  email in (select email from public.profiles where id = auth.uid())
);

create policy "group_invites_insert_admin" on public.group_invites for insert with check (
  group_id in (select group_id from public.group_members where user_id = auth.uid() and role = 'admin')
);

create policy "group_invites_delete" on public.group_invites for delete using (
  group_id in (select group_id from public.group_members where user_id = auth.uid() and role = 'admin')
  or email in (select email from public.profiles where id = auth.uid())
);

-- RLS Policies for expenses
drop policy if exists "expenses_select_member" on public.expenses;
drop policy if exists "expenses_insert_member" on public.expenses;
drop policy if exists "expenses_update_creator" on public.expenses;
drop policy if exists "expenses_delete_creator" on public.expenses;

create policy "expenses_select_member" on public.expenses for select using (
  group_id in (select group_id from public.group_members where user_id = auth.uid())
);

create policy "expenses_insert_member" on public.expenses for insert with check (
  group_id in (select group_id from public.group_members where user_id = auth.uid())
  and auth.uid() = created_by
);

create policy "expenses_update_creator" on public.expenses for update using (
  created_by = auth.uid()
);

create policy "expenses_delete_creator" on public.expenses for delete using (
  created_by = auth.uid()
);

-- RLS Policies for expense_splits
drop policy if exists "expense_splits_select" on public.expense_splits;
drop policy if exists "expense_splits_insert" on public.expense_splits;
drop policy if exists "expense_splits_delete" on public.expense_splits;

create policy "expense_splits_select" on public.expense_splits for select using (
  expense_id in (
    select id from public.expenses where group_id in (
      select group_id from public.group_members where user_id = auth.uid()
    )
  )
);

create policy "expense_splits_insert" on public.expense_splits for insert with check (
  expense_id in (
    select id from public.expenses where created_by = auth.uid()
  )
);

create policy "expense_splits_delete" on public.expense_splits for delete using (
  expense_id in (
    select id from public.expenses where created_by = auth.uid()
  )
);
