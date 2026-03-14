-- Add support for archiving groups while keeping history readable.

alter table public.groups
add column if not exists archived_at timestamptz;
