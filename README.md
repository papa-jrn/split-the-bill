# Split the Bills

A shared-expense app built with the AHA Stack, Next.js, and Supabase.

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in your Supabase project values.

3. In Supabase SQL Editor, run these scripts in order:

```text
scripts/001_create_tables.sql
scripts/002_profile_trigger.sql
scripts/003_fix_rls_policies.sql
scripts/004_fix_group_visibility.sql
scripts/005_backfill_profiles_and_memberships.sql
scripts/006_fix_profile_visibility.sql
scripts/007_add_group_messages.sql
scripts/008_add_group_archiving.sql
scripts/009_add_group_payments.sql
```

4. In Supabase Authentication settings, add this redirect URL:

```text
http://localhost:3000/auth/callback
```

5. Start the app:

```bash
npm run dev
```

## What is configured

- Email/password auth with email confirmation callback handling
- Profiles, groups, members, invites, expenses, and expense splits tables
- Row-level security policies for group-based access
- Automatic profile creation and invite acceptance on sign-up

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL`
- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `INVITE_FROM_EMAIL`

## Email invites

Set up a [Resend](https://resend.com) API key and a verified sender address, then add these Vercel environment variables:

- `NEXT_PUBLIC_APP_URL`
- `RESEND_API_KEY`
- `INVITE_FROM_EMAIL`

When you invite a brand new email address, the app will store the invite in `group_invites`, send an email, and automatically attach the user to the group after they sign up with that same email.

## Existing projects

If you already ran only the first two SQL files in Supabase, apply `003` through `006` in order to bring your database up to the current working policy set.
