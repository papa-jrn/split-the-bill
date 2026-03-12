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
