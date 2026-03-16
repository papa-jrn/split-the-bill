-- Seed realistic demo data for local testing in Supabase SQL Editor.
--
-- Test accounts created by this script:
--   alice@test.com / password123
--   bob@test.com   / password123
--   carol@test.com / password123
--   dave@test.com  / password123
--
-- This script is idempotent for the seeded records below:
-- it removes any previous copy of these demo users/groups, then recreates them.

begin;

do $$
begin
  if to_regclass('public.groups') is null
    or to_regclass('public.group_members') is null
    or to_regclass('public.expenses') is null
    or to_regclass('public.expense_splits') is null
    or to_regclass('public.group_messages') is null
    or to_regclass('public.group_payments') is null then
    raise exception
      'Missing required tables. Run schema migrations 001 through 009 before running 010_seed_realistic_test_data.sql.';
  end if;
end
$$;

-- Clean up any previously seeded groups, related records, and demo auth users.
delete from public.group_payments
where group_id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);

delete from public.group_messages
where group_id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
);

delete from public.groups
where id in (
  '11111111-1111-1111-1111-111111111111'::uuid,
  '22222222-2222-2222-2222-222222222222'::uuid
)
or name in ('Berlin Trip', 'Monthly Rent');

delete from auth.identities
where user_id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
)
or identity_data ->> 'email' in (
  'alice@test.com',
  'bob@test.com',
  'carol@test.com',
  'dave@test.com'
);

delete from auth.users
where id in (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
  'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid
)
or email in (
  'alice@test.com',
  'bob@test.com',
  'carol@test.com',
  'dave@test.com'
);

with seeded_users as (
  select *
  from (
    values
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'alice@test.com', 'Alice'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'bob@test.com', 'Bob'),
      ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'carol@test.com', 'Carol'),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'dave@test.com', 'Dave')
  ) as t (id, email, display_name)
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  invited_at,
  confirmation_token,
  confirmation_sent_at,
  recovery_token,
  recovery_sent_at,
  email_change_token_new,
  email_change,
  email_change_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at,
  phone,
  phone_confirmed_at,
  phone_change,
  phone_change_token,
  phone_change_sent_at,
  email_change_token_current,
  email_change_confirm_status,
  banned_until,
  reauthentication_token,
  reauthentication_sent_at,
  is_sso_user,
  deleted_at,
  is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  id,
  'authenticated',
  'authenticated',
  email,
  crypt('password123', gen_salt('bf')),
  now(),
  null,
  '',
  null,
  '',
  null,
  '',
  '',
  null,
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', display_name),
  false,
  now(),
  now(),
  null,
  null,
  '',
  '',
  null,
  '',
  0,
  null,
  '',
  null,
  false,
  null,
  false
from seeded_users;

with seeded_users as (
  select *
  from (
    values
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'alice@test.com', 'Alice'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'bob@test.com', 'Bob'),
      ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'carol@test.com', 'Carol'),
      ('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'dave@test.com', 'Dave')
  ) as t (id, email, display_name)
)
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  id,
  jsonb_build_object(
    'sub', id::text,
    'email', email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  id::text,
  now(),
  now(),
  now()
from seeded_users;

update public.profiles
set
  email = seeded.email,
  display_name = seeded.display_name
from (
  values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'alice@test.com', 'Alice'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'bob@test.com', 'Bob'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'carol@test.com', 'Carol'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'dave@test.com', 'Dave')
) as seeded (id, email, display_name)
where public.profiles.id = seeded.id;

insert into public.groups (
  id,
  name,
  description,
  created_by,
  created_at
)
values
  (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Berlin Trip',
    'A long weekend in Berlin with flights, transit, shared meals, and sightseeing.',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '2026-02-01T09:00:00Z'::timestamptz
  ),
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Monthly Rent',
    'Shared household costs for Alice and Dave, including rent, utilities, and groceries.',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '2026-03-01T09:00:00Z'::timestamptz
  );

insert into public.group_members (
  group_id,
  user_id,
  role,
  joined_at
)
values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'admin', '2026-02-01T09:00:00Z'::timestamptz),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 'member', '2026-02-01T09:05:00Z'::timestamptz),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'member', '2026-02-01T09:10:00Z'::timestamptz),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 'admin', '2026-03-01T09:00:00Z'::timestamptz),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 'member', '2026-03-01T09:05:00Z'::timestamptz);

insert into public.expenses (
  id,
  group_id,
  description,
  amount_cents,
  paid_by,
  created_by,
  expense_date,
  created_at
)
values
  (
    '10000000-0000-0000-0000-000000000001'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Round-trip flights',
    54000,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '2026-02-08',
    '2026-02-08T12:00:00Z'::timestamptz
  ),
  (
    '10000000-0000-0000-0000-000000000002'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Airbnb deposit',
    42000,
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    '2026-02-09',
    '2026-02-09T15:00:00Z'::timestamptz
  ),
  (
    '10000000-0000-0000-0000-000000000003'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Dinner at Mustafa''s',
    8640,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    '2026-02-10',
    '2026-02-10T20:30:00Z'::timestamptz
  ),
  (
    '10000000-0000-0000-0000-000000000004'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Museum tickets',
    7200,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '2026-02-11',
    '2026-02-11T14:10:00Z'::timestamptz
  ),
  (
    '10000000-0000-0000-0000-000000000005'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'U-Bahn transit cards',
    5400,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    '2026-02-11',
    '2026-02-11T18:40:00Z'::timestamptz
  ),
  (
    '10000000-0000-0000-0000-000000000006'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Groceries for breakfast',
    3875,
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid,
    '2026-02-12',
    '2026-02-12T08:15:00Z'::timestamptz
  ),
  (
    '10000000-0000-0000-0000-000000000007'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Settlement: Bob paid Alice',
    4500,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '2026-02-13',
    '2026-02-13T19:00:00Z'::timestamptz
  ),
  (
    '20000000-0000-0000-0000-000000000001'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'March rent',
    160000,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '2026-03-01',
    '2026-03-01T13:00:00Z'::timestamptz
  ),
  (
    '20000000-0000-0000-0000-000000000002'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Electric + internet',
    18627,
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    '2026-03-06',
    '2026-03-06T23:00:00Z'::timestamptz
  ),
  (
    '20000000-0000-0000-0000-000000000003'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Trader Joe''s groceries',
    9418,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    '2026-03-09',
    '2026-03-09T18:20:00Z'::timestamptz
  );

insert into public.expense_splits (
  expense_id,
  user_id,
  amount_cents
)
values
  ('10000000-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 18000),
  ('10000000-0000-0000-0000-000000000001'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 18000),
  ('10000000-0000-0000-0000-000000000001'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 18000),

  ('10000000-0000-0000-0000-000000000002'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 14000),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 14000),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 14000),

  ('10000000-0000-0000-0000-000000000003'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 2880),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 2880),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 2880),

  ('10000000-0000-0000-0000-000000000004'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 3600),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 3600),

  ('10000000-0000-0000-0000-000000000005'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 1800),
  ('10000000-0000-0000-0000-000000000005'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 1800),
  ('10000000-0000-0000-0000-000000000005'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 1800),

  ('10000000-0000-0000-0000-000000000006'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 1292),
  ('10000000-0000-0000-0000-000000000006'::uuid, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid, 1292),
  ('10000000-0000-0000-0000-000000000006'::uuid, 'cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 1291),

  ('10000000-0000-0000-0000-000000000007'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 4500),

  ('20000000-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 80000),
  ('20000000-0000-0000-0000-000000000001'::uuid, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 80000),

  ('20000000-0000-0000-0000-000000000002'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 9314),
  ('20000000-0000-0000-0000-000000000002'::uuid, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 9313),

  ('20000000-0000-0000-0000-000000000003'::uuid, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid, 4709),
  ('20000000-0000-0000-0000-000000000003'::uuid, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 4709);

insert into public.group_messages (
  group_id,
  user_id,
  body,
  created_at
)
values
  (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'I booked the flights. Add anything trip-related here so we keep the totals accurate.',
    '2026-02-08T12:05:00Z'::timestamptz
  ),
  (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'Added dinner and transit. I still owe Alice a chunk, so the balances should be interesting now.',
    '2026-02-11T19:00:00Z'::timestamptz
  ),
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'Rent is in. I also grabbed groceries, so we should have a good test case for normal recurring costs.',
    '2026-03-09T18:30:00Z'::timestamptz
  ),
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    'I marked utilities and I''ll confirm the rent payment once it lands.',
    '2026-03-10T08:15:00Z'::timestamptz
  );

insert into public.group_payments (
  group_id,
  from_user_id,
  to_user_id,
  amount_cents,
  status,
  created_by,
  created_at,
  paid_marked_at,
  confirmed_at
)
values
  (
    '22222222-2222-2222-2222-222222222222'::uuid,
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    75395,
    'pending',
    'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid,
    '2026-03-10T08:10:00Z'::timestamptz,
    '2026-03-10T08:10:00Z'::timestamptz,
    null
  );

commit;
