-- Migration 17: Google OAuth onboarding company profile and email invitations.
-- Existing workspaces are backfilled with safe legacy defaults. New workspace creation
-- through the application requires explicit company details via the authenticated RPC.

begin;

alter table public.organizations
  add column if not exists industry text not null default 'Other',
  add column if not exists company_size text not null default '1-10',
  add column if not exists country text not null default 'Unknown',
  add column if not exists website text,
  add column if not exists phone text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_industry_nonempty_chk'
  ) then
    alter table public.organizations
      add constraint organizations_industry_nonempty_chk
      check (char_length(trim(industry)) between 2 and 120);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_company_size_chk'
  ) then
    alter table public.organizations
      add constraint organizations_company_size_chk
      check (company_size in ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_country_nonempty_chk'
  ) then
    alter table public.organizations
      add constraint organizations_country_nonempty_chk
      check (char_length(trim(country)) between 2 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_website_scheme_chk'
  ) then
    alter table public.organizations
      add constraint organizations_website_scheme_chk
      check (website is null or website ~* '^https?://');
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.organizations'::regclass
      and conname = 'organizations_phone_length_chk'
  ) then
    alter table public.organizations
      add constraint organizations_phone_length_chk
      check (phone is null or char_length(phone) <= 40);
  end if;
end;
$$;

-- Do not leave a second client-callable path that can create a workspace without
-- completing the company profile. The new RPC is granted to authenticated callers only.
revoke all on function public.create_organization_with_owner(text, text)
  from public, anon, authenticated;

create or replace function public.create_organization_with_company_profile(
  p_name text,
  p_slug text,
  p_industry text,
  p_company_size text,
  p_country text,
  p_website text default null,
  p_phone text default null
)
returns public.organizations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_full_name text;
  v_created_count integer;
  v_org public.organizations;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(trim(coalesce(p_name, ''))) not between 2 and 120 then
    raise exception 'Company name must be between 2 and 120 characters'
      using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_slug, ''))) not between 2 and 63
    or lower(trim(coalesce(p_slug, ''))) !~ '^[a-z0-9]+(-[a-z0-9]+)*
  if char_length(trim(coalesce(p_industry, ''))) not between 2 and 120 then
    raise exception 'Industry is required'
      using errcode = '22023';
  end if;
  if trim(coalesce(p_company_size, '')) not in ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+') then
    raise exception 'Invalid company size'
      using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_country, ''))) not between 2 and 100 then
    raise exception 'Country is required'
      using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_website, '')), '') is not null
    and trim(p_website) !~* '^https?://' then
    raise exception 'Company website must start with http:// or https://'
      using errcode = '22023';
  end if;
  if p_phone is not null and char_length(trim(p_phone)) > 40 then
    raise exception 'Company phone number is too long'
      using errcode = '22023';
  end if;

  select lower(trim(u.email)),
         coalesce(
           nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
           ''
         )
    into v_email, v_full_name
    from auth.users u
   where u.id = v_user_id;

  if v_email is null or char_length(v_email) < 4 then
    raise exception 'Authenticated user email could not be verified'
      using errcode = '42501';
  end if;

  select count(*)::integer
    into v_created_count
    from public.organizations o
   where o.created_by = v_user_id;

  if v_created_count >= 10 then
    raise exception 'Organization creation limit reached for this account (maximum 10 organizations)'
      using errcode = '42501';
  end if;

  insert into public.profiles as existing_profile (id, email, full_name)
  values (v_user_id, v_email, v_full_name)
  on conflict (id) do update
    set email = excluded.email,
        full_name = case
          when trim(coalesce(existing_profile.full_name, '')) = ''
            then excluded.full_name
          else existing_profile.full_name
        end;

  insert into public.organizations (
    name, slug, status, created_by, industry, company_size, country, website, phone
  )
  values (
    trim(p_name),
    lower(trim(p_slug)),
    'active',
    v_user_id,
    trim(p_industry),
    trim(p_company_size),
    trim(p_country),
    nullif(trim(coalesce(p_website, '')), ''),
    nullif(trim(coalesce(p_phone, '')), '')
  )
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org.id, v_user_id, 'admin', 'active');

  -- The existing organization-insert trigger provisions the default Pilot trial.
  return v_org;
end;
$$;

revoke all on function public.create_organization_with_company_profile(
  text, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.create_organization_with_company_profile(
  text, text, text, text, text, text, text
) to authenticated;

commit;
 then
    raise exception 'Invalid company workspace slug'
      using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_industry, ''))) not between 2 and 120 then
    raise exception 'Industry is required'
      using errcode = '22023';
  end if;
  if trim(coalesce(p_company_size, '')) not in ('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+') then
    raise exception 'Invalid company size'
      using errcode = '22023';
  end if;
  if char_length(trim(coalesce(p_country, ''))) not between 2 and 100 then
    raise exception 'Country is required'
      using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_website, '')), '') is not null
    and trim(p_website) !~* '^https?://' then
    raise exception 'Company website must start with http:// or https://'
      using errcode = '22023';
  end if;
  if p_phone is not null and char_length(trim(p_phone)) > 40 then
    raise exception 'Company phone number is too long'
      using errcode = '22023';
  end if;

  select lower(trim(u.email)),
         coalesce(
           nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
           ''
         )
    into v_email, v_full_name
    from auth.users u
   where u.id = v_user_id;

  if v_email is null or char_length(v_email) < 4 then
    raise exception 'Authenticated user email could not be verified'
      using errcode = '42501';
  end if;

  insert into public.profiles (id, email, full_name)
  values (v_user_id, v_email, v_full_name)
  on conflict (id) do update
    set email = excluded.email,
        full_name = case
          when trim(coalesce(existing_profile.full_name, '')) = ''
            then excluded.full_name
          else existing_profile.full_name
        end;

  insert into public.organizations (
    name, slug, status, created_by, industry, company_size, country, website, phone
  )
  values (
    trim(p_name),
    lower(trim(p_slug)),
    'active',
    v_user_id,
    trim(p_industry),
    trim(p_company_size),
    trim(p_country),
    nullif(trim(coalesce(p_website, '')), ''),
    nullif(trim(coalesce(p_phone, '')), '')
  )
  returning * into v_org;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_org.id, v_user_id, 'admin', 'active');

  -- The existing organization-insert trigger provisions the default Pilot trial.
  return v_org;
end;
$$;

revoke all on function public.create_organization_with_company_profile(
  text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.create_organization_with_company_profile(
  text, text, text, text, text, text, text
) to authenticated;

commit;
