-- PatrolIQ Phase 2 Schema Extension
-- Adds Incidents, Devices, Audit Logs, and enhanced Patrol telemetry fields

-- 1. Create incident_category enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'incident_category') then
    create type public.incident_category as enum (
      'security_breach',
      'suspicious_person',
      'theft_suspected',
      'intrusion',
      'fire',
      'equipment_failure',
      'damaged_infrastructure',
      'unauthorised_access',
      'safety_concern',
      'other'
    );
  end if;
end $$;

-- 2. Create incident_severity enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'incident_severity') then
    create type public.incident_severity as enum ('low', 'medium', 'high', 'critical');
  end if;
end $$;

-- 3. Create incident_status enum
do $$
begin
  if not exists (select 1 from pg_type where typname = 'incident_status') then
    create type public.incident_status as enum ('open', 'under_investigation', 'resolved');
  end if;
end $$;

-- 4. Add columns to checkpoints if missing
alter table public.checkpoints 
  add column if not exists is_active boolean not null default true;

-- 5. Add columns to routes if missing
alter table public.routes 
  add column if not exists is_active boolean not null default true;

-- 6. Add columns to shifts if missing
alter table public.shifts 
  add column if not exists start_location geography(Point, 4326),
  add column if not exists checkpoints_completed integer not null default 0,
  add column if not exists checkpoints_missed integer not null default 0,
  add column if not exists geofence_breaches integer not null default 0;

-- 7. Add telemetry columns to checkpoint_scans
alter table public.checkpoint_scans 
  add column if not exists gps_accuracy numeric,
  add column if not exists is_duplicate boolean not null default false,
  add column if not exists observation_category text;

-- 8. Create incidents table
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  client_generated_id uuid unique not null,
  shift_id uuid references public.shifts(id) on delete cascade not null,
  site_id uuid references public.sites(id) on delete cascade not null,
  reported_by uuid references public.profiles(id) on delete cascade not null,
  category public.incident_category not null default 'other'::public.incident_category,
  title text not null,
  description text not null,
  severity public.incident_severity not null default 'medium'::public.incident_severity,
  status public.incident_status not null default 'open'::public.incident_status,
  location geography(Point, 4326),
  photo_url text,
  voice_note_url text,
  reported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. Create devices table for tracking mobile guard sessions
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  device_id text not null,
  device_name text,
  platform text,
  app_version text,
  last_active_at timestamptz not null default now(),
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  constraint user_device_unique unique (user_id, device_id)
);

-- 10. Create audit_logs table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

-- 11. Indexes for performance
create index if not exists incidents_location_idx on public.incidents using gist (location);
create index if not exists incidents_shift_idx on public.incidents (shift_id);
create index if not exists incidents_site_idx on public.incidents (site_id);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

-- 12. Enable RLS on new tables
alter table public.incidents enable row level security;
alter table public.devices enable row level security;
alter table public.audit_logs enable row level security;

-- 13. RLS Policies for Incidents
create policy "Allow authenticated users to read incidents"
  on public.incidents for select
  to authenticated
  using (true);

create policy "Allow guards to insert incidents for their own shifts"
  on public.incidents for insert
  to authenticated
  with check (
    reported_by = auth.uid() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

create policy "Allow supervisors and admins to update incidents"
  on public.incidents for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

-- 14. RLS Policies for Devices
create policy "Allow users to view their own device sessions"
  on public.devices for select
  to authenticated
  using (
    user_id = auth.uid() or
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

create policy "Allow users to register and update their own device session"
  on public.devices for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 15. RLS Policies for Audit Logs
create policy "Allow admins and supervisors to read audit logs"
  on public.audit_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'supervisor')
    )
  );

create policy "Allow authenticated users to insert audit log records"
  on public.audit_logs for insert
  to authenticated
  with check (true);

-- 16. Add Realtime for Incidents
alter publication supabase_realtime add table public.incidents;

-- 17. Server-Authoritative Checkpoint Validation RPC Function
create or replace function public.record_checkpoint_scan(
  p_client_generated_id uuid,
  p_shift_id uuid,
  p_checkpoint_id uuid,
  p_scanned_by uuid,
  p_scanned_at timestamptz,
  p_longitude numeric,
  p_latitude numeric,
  p_gps_accuracy numeric default null,
  p_observation_category text default null,
  p_notes text default null,
  p_photo_url text default null,
  p_voice_note_url text default null
)
returns jsonb as $$
declare
  v_cp_location geography(Point, 4326);
  v_cp_radius numeric;
  v_cp_name text;
  v_cp_active boolean;
  v_shift_user_id uuid;
  v_shift_site_id uuid;
  v_route_site_id uuid;
  v_distance_meters numeric;
  v_within_geofence boolean;
  v_is_duplicate boolean := false;
  v_scan_id uuid;
  v_recent_scans_count integer;
begin
  -- 1. Validate Shift Ownership and Active Status
  select user_id, site_id into v_shift_user_id, v_shift_site_id
  from public.shifts
  where id = p_shift_id and ended_at is null;

  if v_shift_user_id is null then
    raise exception 'Invalid or ended shift ID: %', p_shift_id;
  end if;

  if v_shift_user_id <> p_scanned_by then
    raise exception 'Guard ID % does not match active shift owner %', p_scanned_by, v_shift_user_id;
  end if;

  -- 2. Validate Checkpoint Assignment & Active Status
  select c.location, c.geofence_radius_meters, c.name, c.is_active, r.site_id
  into v_cp_location, v_cp_radius, v_cp_name, v_cp_active, v_route_site_id
  from public.checkpoints c
  join public.routes r on c.route_id = r.id
  where c.id = p_checkpoint_id;

  if v_cp_name is null then
    raise exception 'Checkpoint % not found', p_checkpoint_id;
  end if;

  if not v_cp_active then
    raise exception 'Checkpoint % (%) is currently inactive', v_cp_name, p_checkpoint_id;
  end if;

  if v_route_site_id <> v_shift_site_id then
    raise exception 'Checkpoint % belongs to a different site than the Guard active shift site', v_cp_name;
  end if;

  -- 3. Calculate Spatial Geofence Distance (PostGIS)
  v_distance_meters := ST_Distance(
    v_cp_location,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
  );

  v_within_geofence := (v_distance_meters <= v_cp_radius);

  -- 4. Check Duplicate Scan Window (2 minutes)
  select count(*) into v_recent_scans_count
  from public.checkpoint_scans
  where shift_id = p_shift_id
    and checkpoint_id = p_checkpoint_id
    and scanned_at >= (p_scanned_at - interval '2 minutes');

  if v_recent_scans_count > 0 then
    v_is_duplicate := true;
  end if;

  -- 5. Insert Checkpoint Scan Record Idempotently
  insert into public.checkpoint_scans (
    client_generated_id,
    checkpoint_id,
    shift_id,
    scanned_by,
    scanned_at,
    scan_location,
    gps_accuracy,
    within_geofence,
    is_duplicate,
    observation_category,
    notes,
    photo_url,
    voice_note_url
  ) values (
    p_client_generated_id,
    p_checkpoint_id,
    p_shift_id,
    p_scanned_by,
    p_scanned_at,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    p_gps_accuracy,
    v_within_geofence,
    v_is_duplicate,
    p_observation_category,
    p_notes,
    p_photo_url,
    p_voice_note_url
  )
  on conflict (client_generated_id) do nothing
  returning id into v_scan_id;

  -- 6. Update Shift Telemetry Counters
  if not v_is_duplicate then
    update public.shifts
    set checkpoints_completed = checkpoints_completed + 1,
        geofence_breaches = geofence_breaches + (case when v_within_geofence then 0 else 1 end)
    where id = p_shift_id;
  end if;

  -- 7. Audit Log Event
  insert into public.audit_logs (user_id, action, entity_type, entity_id, details)
  values (
    p_scanned_by,
    'CHECKPOINT_SCAN',
    'checkpoint_scans',
    p_client_generated_id::text,
    jsonb_build_object(
      'checkpoint_name', v_cp_name,
      'within_geofence', v_within_geofence,
      'distance_meters', v_distance_meters,
      'is_duplicate', v_is_duplicate
    )
  );

  -- 8. Return Validation Package
  return jsonb_build_object(
    'status', case when not v_within_geofence then 'GEOFENCE_BREACH' when v_is_duplicate then 'DUPLICATE_FLAGGED' else 'SUCCESS' end,
    'scan_id', v_scan_id,
    'checkpoint_name', v_cp_name,
    'within_geofence', v_within_geofence,
    'distance_meters', round(v_distance_meters, 1),
    'geofence_radius_meters', v_cp_radius,
    'is_duplicate', v_is_duplicate
  );
end;
$$ language plpgsql security definer;
