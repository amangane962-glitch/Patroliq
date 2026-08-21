-- PatrolIQ Phase 1 Database Schema
-- Supabase PostgreSQL + PostGIS Configuration

-- Enable PostGIS extension for spatial queries (geofencing and coordinates)
create extension if not exists postgis;

-- Create user_role enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('admin', 'supervisor', 'guard', 'client');
  end if;
end $$;

-- Create profiles table (linked to auth.users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null unique,
  name text,
  role public.user_role not null default 'guard'::public.user_role,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create sites table (with Polygon geofence)
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  geofence geography(Polygon, 4326) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create routes table
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routes_site_name_unique unique (site_id, name)
);

-- Create checkpoints table (with Point location)
create table if not exists public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  route_id uuid references public.routes(id) on delete cascade not null,
  name text not null,
  tag_code text not null unique, -- QR or NFC unique tag code
  geofence_radius_meters numeric not null default 15.0,
  location geography(Point, 4326) not null,
  sequence_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create shifts table
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  site_id uuid references public.sites(id) on delete cascade not null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  guard_notes text, -- Guard wrap-up report notes
  created_at timestamptz not null default now()
);

-- Create checkpoint_scans table
create table if not exists public.checkpoint_scans (
  id uuid primary key default gen_random_uuid(),
  client_generated_id uuid unique not null, -- generated on client device for offline sync
  checkpoint_id uuid references public.checkpoints(id) on delete cascade not null,
  shift_id uuid references public.shifts(id) on delete cascade not null,
  scanned_by uuid references public.profiles(id) on delete cascade not null,
  scanned_at timestamptz not null,
  scan_location geography(Point, 4326) not null,
  within_geofence boolean not null,
  is_overwritten boolean not null default false,
  notes text, -- Guard observation description notes
  photo_url text, -- Public storage link to attached photo
  voice_note_url text, -- Public storage link to attached voice note memo
  created_at timestamptz not null default now()
);

-- Create shift_reports table (compiled supervisor review card for management)
create table if not exists public.shift_reports (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references public.shifts(id) on delete cascade unique not null,
  summary_notes text, -- Supervisor review comments
  rating integer check (rating >= 1 and rating <= 5),
  total_scans integer not null default 0,
  geofence_breaches integer not null default 0,
  created_at timestamptz not null default now()
);

-- Indexes for geofencing performance
create index if not exists sites_geofence_idx on public.sites using gist (geofence);
create index if not exists checkpoints_location_idx on public.checkpoints using gist (location);
create index if not exists checkpoint_scans_location_idx on public.checkpoint_scans using gist (scan_location);

-- Function to flag overwritten scans in case of conflicts
create or replace function public.flag_overwritten_scan(old_scan_id uuid)
returns void as $$
begin
  update public.checkpoint_scans
  set is_overwritten = true
  where id = old_scan_id;
end;
$$ language plpgsql security definer;

-- Trigger to automatically create a profile record when a new user signs up in auth
create or replace function public.handle_new_user()
returns trigger as $$
declare
  default_role public.user_role;
begin
  -- Retrieve role from user metadata, default to 'guard'
  default_role := coalesce(
    (new.raw_user_meta_data->>'role')::public.user_role,
    'guard'::public.user_role
  );

  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    default_role
  );
  return new;
end;
$$ language plpgsql security definer;

-- Bind trigger to auth.users
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Enable Row Level Security (RLS) on all tables
alter table public.profiles enable row level security;
alter table public.sites enable row level security;
alter table public.routes enable row level security;
alter table public.checkpoints enable row level security;
alter table public.shifts enable row level security;
alter table public.checkpoint_scans enable row level security;
alter table public.shift_reports enable row level security;

-- Profiles Policies
create policy "Allow read access to profiles for authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Allow admin and supervisor to insert/update profiles"
  on public.profiles for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

create policy "Allow users to update their own profile name/email"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

-- Sites Policies
create policy "Allow read access to sites for authenticated users"
  on public.sites for select
  to authenticated
  using (true);

create policy "Allow admin and supervisor to manage sites"
  on public.sites for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

-- Routes Policies
create policy "Allow read access to routes for authenticated users"
  on public.routes for select
  to authenticated
  using (true);

create policy "Allow admin and supervisor to manage routes"
  on public.routes for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

-- Checkpoints Policies
create policy "Allow read access to checkpoints for authenticated users"
  on public.checkpoints for select
  to authenticated
  using (true);

create policy "Allow admin and supervisor to manage checkpoints"
  on public.checkpoints for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

-- Shifts Policies
create policy "Allow guards to view their own shifts"
  on public.shifts for select
  to authenticated
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor', 'client')
    )
  );

create policy "Allow guards to insert/update their own shifts"
  on public.shifts for all
  to authenticated
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  )
  with check (
    user_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

-- Checkpoint Scans Policies
create policy "Allow authenticated users to read checkpoint scans"
  on public.checkpoint_scans for select
  to authenticated
  using (true);

create policy "Allow guards to insert checkpoint scans during active shifts"
  on public.checkpoint_scans for insert
  to authenticated
  with check (
    scanned_by = auth.uid() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

-- Shift Reports Policies
create policy "Allow authenticated users to read shift reports"
  on public.shift_reports for select
  to authenticated
  using (true);

create policy "Allow admin and supervisor to manage shift reports"
  on public.shift_reports for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

-- Enable Supabase Realtime subscriptions
begin;
  -- Drop publication if it exists to refresh tables
  drop publication if exists supabase_realtime;
  create publication supabase_realtime;
commit;

alter publication supabase_realtime add table public.checkpoint_scans;
alter publication supabase_realtime add table public.shifts;
alter publication supabase_realtime add table public.shift_reports;

-- Setup Supabase Storage bucket for patrol media uploads (photos and voice notes)
insert into storage.buckets (id, name, public)
values ('patrol_media', 'patrol_media', true)
on conflict (id) do nothing;

-- Storage Row Level Security policies
alter table storage.objects enable row level security;

create policy "Allow authenticated users to upload media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'patrol_media');

create policy "Allow authenticated users to read media"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'patrol_media');
