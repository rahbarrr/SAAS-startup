-- Migration: 20261022000011_rate_limits.sql
-- Purpose: Postgres-backed fixed-window rate limiting for authentication, AI drafts and uploads.
--   - `public.rate_limit_buckets` is RLS-locked with no client grants; only the SECURITY DEFINER
--     function `public.consume_rate_limit` can touch it.
--   - Scope is allow-listed so callers cannot create arbitrary bucket families.
--   - Subject is hashed (md5) and never stored raw, so emails/IPs are not persisted in plain text.
--   - Callable by `anon` (needed for pre-login auth throttling) and `authenticated`.
--   - Limits and window are bounded inside the function; callers cannot request unlimited quotas.

-- migration-review: anon-grant-approved (consume_rate_limit must be callable before login;
-- function is allow-listed by scope, bounded, and hashes subjects)

begin;

create table public.rate_limit_buckets (
  scope text not null,
  subject_hash text not null,
  window_start timestamptz not null,
  hit_count integer not null default 0,
  primary key (scope, subject_hash, window_start),
  constraint rate_limit_buckets_scope_chk check (
    scope in ('auth_sign_in', 'auth_sign_up', 'auth_recovery', 'ai_draft', 'upload')
  ),
  constraint rate_limit_buckets_hit_count_chk check (hit_count >= 0)
);

create index idx_rate_limit_buckets_window_start
  on public.rate_limit_buckets (window_start);

alter table public.rate_limit_buckets enable row level security;
alter table public.rate_limit_buckets force row level security;
-- Intentionally no policies and no grants: direct client access is denied.

create or replace function public.consume_rate_limit(
  p_scope text,
  p_subject text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_scope is null
     or p_scope not in ('auth_sign_in', 'auth_sign_up', 'auth_recovery', 'ai_draft', 'upload') then
    raise exception 'Unknown rate limit scope' using errcode = '22023';
  end if;

  if p_subject is null or char_length(p_subject) = 0 or char_length(p_subject) > 256 then
    raise exception 'Invalid rate limit subject' using errcode = '22023';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 1000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_buckets as b (scope, subject_hash, window_start, hit_count)
  values (p_scope, md5(p_subject), v_window_start, 1)
  on conflict (scope, subject_hash, window_start)
  do update set hit_count = b.hit_count + 1
  returning b.hit_count into v_hits;

  -- Opportunistic cleanup of expired buckets (bounded work per call)
  if random() < 0.01 then
    delete from public.rate_limit_buckets
     where window_start < clock_timestamp() - interval '2 days';
  end if;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to anon, authenticated;

commit;
