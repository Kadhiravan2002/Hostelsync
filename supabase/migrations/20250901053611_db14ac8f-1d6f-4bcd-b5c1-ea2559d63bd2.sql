
-- 1) Enforce "only one admin" globally
-- A partial unique index on role where role = 'admin' ensures at most one admin exists.
create unique index if not exists profiles_one_admin_idx
  on public.profiles (role)
  where role = 'admin'::user_role;

-- 2) Admin transfer workflow table
do $$
begin
  -- Create enum for transfer status if it doesn't exist
  create type public.admin_transfer_status as enum ('pending', 'approved', 'rejected');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.admin_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null,
  new_email text not null,
  status public.admin_transfer_status not null default 'pending',
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  notes text
);

alter table public.admin_transfer_requests enable row level security;

-- Only admins can manage transfer requests (select/insert/update/delete)
drop policy if exists "Admins manage admin transfer requests (all)" on public.admin_transfer_requests;
create policy "Admins manage admin transfer requests (all)"
  on public.admin_transfer_requests
  for all
  using (get_current_user_role() = 'admin'::user_role)
  with check (get_current_user_role() = 'admin'::user_role);

create index if not exists admin_transfer_requests_requested_by_idx
  on public.admin_transfer_requests (requested_by);

-- 3) Try to promote the provided email to admin now if the profile already exists
update public.profiles
set role = 'admin'::user_role, is_approved = true
where email = 'kadhiravan2026@gmail.com';

-- 4) Temporary bootstrap: auto-promote this specific email to admin when a profile is inserted
-- This ensures that if the user signs up after this migration, their profile becomes admin immediately.
create or replace function public.auto_promote_specific_admin()
returns trigger
language plpgsql
security definer
set search_path = 'public'
as $func$
begin
  if new.email = 'kadhiravan2026@gmail.com' then
    new.role := 'admin'::user_role;
    new.is_approved := true;
  end if;
  return new;
end;
$func$;

drop trigger if exists trg_auto_promote_specific_admin on public.profiles;
create trigger trg_auto_promote_specific_admin
before insert on public.profiles
for each row
execute function public.auto_promote_specific_admin();
