-- Auto-create profile when user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  -- Auto-accept any pending invites for this email
  insert into public.group_members (group_id, user_id, role)
  select gi.group_id, new.id, 'member'
  from public.group_invites gi
  where gi.email = new.email
  on conflict (group_id, user_id) do nothing;

  -- Remove accepted invites
  delete from public.group_invites where email = new.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
