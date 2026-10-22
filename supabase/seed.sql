-- ============================================================================
-- LOCAL DEVELOPMENT SEED DATA ONLY (`supabase/seed.sql`)
-- DO NOT RUN AGAINST PRODUCTION.
-- ============================================================================

begin;

-- 1. Seed Auth Users (for local Supabase / test environments)
insert into auth.users (id, email)
values
  ('10000000-0000-4000-8000-000000000001', 'alice.admin@acme.local'),
  ('10000000-0000-4000-8000-000000000002', 'marcus.manager@acme.local'),
  ('10000000-0000-4000-8000-000000000003', 'fiona.field@acme.local'),
  ('10000000-0000-4000-8000-000000000004', 'invited.rep@acme.local'),
  ('10000000-0000-4000-8000-000000000005', 'brenda.manager@beta.local')
on conflict (id) do nothing;

-- 2. Seed User Profiles
insert into public.profiles (id, email, full_name)
values
  ('10000000-0000-4000-8000-000000000001', 'alice.admin@acme.local', 'Alice Admin'),
  ('10000000-0000-4000-8000-000000000002', 'marcus.manager@acme.local', 'Marcus Manager'),
  ('10000000-0000-4000-8000-000000000003', 'fiona.field@acme.local', 'Fiona Field'),
  ('10000000-0000-4000-8000-000000000004', 'invited.rep@acme.local', 'Ivan Invited'),
  ('10000000-0000-4000-8000-000000000005', 'brenda.manager@beta.local', 'Brenda Beta Manager')
on conflict (id) do nothing;

-- 3. Seed Organizations
insert into public.organizations (id, name, slug, status, created_by)
values
  (
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Acme Retail North',
    'acme-retail-north',
    'active',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Beta FMCG South',
    'beta-fmcg-south',
    'active',
    '10000000-0000-4000-8000-000000000005'
  )
on conflict (id) do nothing;

-- 4. Seed Organization Members
insert into public.organization_members (
  id,
  organization_id,
  user_id,
  role,
  status,
  manager_user_id
)
values
  -- Org A: Alice (admin), Marcus (manager), Fiona (field_employee), Ivan (invited)
  (
    '30000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000001',
    'admin',
    'active',
    null
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000002',
    'manager',
    'active',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000003',
    'field_employee',
    'active',
    '10000000-0000-4000-8000-000000000002'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000004',
    'field_employee',
    'invited',
    '10000000-0000-4000-8000-000000000002'
  ),
  -- Org B: Brenda (manager), Alice (multi-org user: field_employee in Org B)
  (
    '30000000-0000-4000-8000-000000000005',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '10000000-0000-4000-8000-000000000005',
    'manager',
    'active',
    null
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    '10000000-0000-4000-8000-000000000001',
    'field_employee',
    'active',
    '10000000-0000-4000-8000-000000000005'
  )
on conflict (organization_id, user_id) do nothing;

-- 5. Seed Stores
insert into public.stores (
  id,
  organization_id,
  name,
  region,
  address_line1,
  city,
  state_province,
  postal_code,
  country_code,
  latitude,
  longitude,
  active
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Downtown Fresh Mart #101',
    'North-Central',
    '120 Main St',
    'Chicago',
    'IL',
    '60601',
    'US',
    41.8837,
    -87.6324,
    true
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'Lakeside Supercenter #204',
    'North-East',
    '850 Lake Shore Dr',
    'Chicago',
    'IL',
    '60611',
    'US',
    41.8975,
    -87.6196,
    true
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Beta Sunbelt Grocers #12',
    'South-West',
    '400 Congress Ave',
    'Austin',
    'TX',
    '78701',
    'US',
    30.2672,
    -97.7431,
    true
  )
on conflict (id) do nothing;

-- 6. Seed Trips
insert into public.trips (
  id,
  organization_id,
  owner_user_id,
  title,
  start_date,
  end_date,
  purpose,
  status,
  submitted_at
)
values
  -- Fiona's draft trip in Org A
  (
    '50000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000003',
    'Q4 Endcap Audit — Downtown',
    '2026-10-25',
    '2026-10-26',
    'Verify promotional endcap compliance and restock levels',
    'draft',
    null
  ),
  -- Fiona's submitted trip in Org A awaiting manager approval
  (
    '50000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000003',
    'Lakeside Beverage Merchandising Run',
    '2026-10-27',
    '2026-10-28',
    'Beverage cooler reset and POS display installation',
    'submitted',
    '2026-10-22T08:00:00Z'
  ),
  -- Marcus Manager's own submitted trip in Org A (cannot be self-approved by Marcus; Alice Admin can approve)
  (
    '50000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000002',
    'Regional Key Account Review',
    '2026-10-29',
    '2026-10-30',
    'Joint business review with store directors',
    'submitted',
    '2026-10-22T08:15:00Z'
  ),
  -- Fiona's approved trip in Org A (ready for active store visit execution)
  (
    '50000000-0000-4000-8000-000000000004',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '10000000-0000-4000-8000-000000000003',
    'Approved North-East Store Execution',
    '2026-10-22',
    '2026-10-23',
    'Approved store execution and shelf compliance check',
    'submitted',
    '2026-10-21T15:00:00Z'
  )
on conflict (id) do nothing;

update public.trips
   set status = 'approved',
       decided_by = '10000000-0000-4000-8000-000000000002',
       decided_at = '2026-10-21T16:00:00Z',
       decision_note = 'Approved for field visit execution'
 where id = '50000000-0000-4000-8000-000000000004'
   and status = 'submitted';

-- 7. Seed Trip Stops
insert into public.trip_stops (
  id,
  organization_id,
  trip_id,
  store_id,
  sequence_number,
  planned_at,
  status
)
values
  (
    '60000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    1,
    '2026-10-25T09:30:00Z',
    'planned'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    1,
    '2026-10-27T10:00:00Z',
    'planned'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '50000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000002',
    1,
    '2026-10-22T09:00:00Z',
    'planned'
  )
on conflict (id) do nothing;

-- 8. Seed Visit, Checklist Item, Evidence, and Audit Event
insert into public.visits (
  id,
  organization_id,
  trip_stop_id,
  employee_user_id,
  checked_in_at,
  check_in_lat,
  check_in_lng,
  notes,
  status
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '60000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000003',
    '2026-10-22T09:05:00Z',
    41.8975,
    -87.6196,
    'Checked in at receiving desk; starting cooler shelf audit.',
    'in_progress'
  )
on conflict (id) do nothing;

insert into public.visit_checklist_items (
  id,
  organization_id,
  visit_id,
  question_key,
  label,
  answer_type,
  answer_value,
  answer_text,
  flagged,
  required,
  completed_at,
  completed_by
)
values
  (
    '80000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '70000000-0000-4000-8000-000000000001',
    'endcap_promo_signage_present',
    'Is the Q4 promotional signage installed on the main endcap?',
    'boolean',
    'true'::jsonb,
    'Yes',
    false,
    true,
    '2026-10-22T09:15:00Z',
    '10000000-0000-4000-8000-000000000003'
  )
on conflict (visit_id, question_key) do nothing;

insert into public.visit_evidence (
  id,
  organization_id,
  visit_id,
  storage_path,
  file_type,
  file_size,
  caption,
  uploaded_by
)
values
  (
    '90000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '70000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/70000000-0000-4000-8000-000000000001/cooler-endcap.jpg',
    'image/jpeg',
    384512,
    'Front view of beverage cooler endcap after restock',
    '10000000-0000-4000-8000-000000000003'
  )
on conflict (storage_path) do nothing;

insert into public.trip_audit_events (
  id,
  organization_id,
  trip_id,
  actor_user_id,
  event_type,
  old_status,
  new_status,
  note,
  metadata
)
values
  (
    'a0000000-0000-4000-8000-000000000001',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    '50000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    'trip_submitted',
    'draft',
    'submitted',
    'Submitted Lakeside merchandising route for manager approval.',
    '{"source": "web", "stop_count": 1}'::jsonb
  )
on conflict (id) do nothing;

commit;
