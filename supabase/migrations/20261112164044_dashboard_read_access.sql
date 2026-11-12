-- Dashboard read-only access layer.
--
-- Adds a private `dashboard` schema (not exposed by the Supabase API) with:
--   * dashboard.dashboard_users : who can open the dashboard (bcrypt-hashed passwords)
--   * read-only views over the existing Zeeker tables
-- and two public functions the static dashboard calls with the anon key:
--   * public.dashboard_login(username, password)
--   * public.dashboard_data(username, password, from, to, tz)
-- Both check the credentials before returning anything.
--
-- Does NOT modify public.movements, public.cat_met, public.cat_people or
-- public.zeeker_send; Zeeker keeps writing exactly as before.
--
-- Add a dashboard user (run in the SQL editor; don't save the query with the password in it):
--   insert into dashboard.dashboard_users (username, display_name, password_hash)
--   values ('manager', 'Manager Name', extensions.crypt('a-strong-password', extensions.gen_salt('bf', 10)));
-- Change a password:
--   update dashboard.dashboard_users
--   set password_hash = extensions.crypt('new-password', extensions.gen_salt('bf', 10))
--   where username = 'manager';

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Private schema: nothing in here is reachable by anon/authenticated directly.
-- ---------------------------------------------------------------------------
create schema dashboard;
revoke all on schema dashboard from public, anon, authenticated;

create table dashboard.dashboard_users (
  username      text primary key check (username ~ '^[a-z0-9._-]{3,40}$'),
  display_name  text check (char_length(display_name) <= 120),
  password_hash text not null,
  created_at    timestamptz not null default now()
);
alter table dashboard.dashboard_users enable row level security;
revoke all on dashboard.dashboard_users from public, anon, authenticated;

-- One row per event, with metric and person resolved.
create view dashboard.v_events as
select mv.id,
       mv.occurred_at,
       mv.user_id,
       p.name  as user_name,
       mv.metric_id,
       m.code  as metric_code,
       m.unit,
       mv.case_number,
       mv.value
from public.movements mv
join public.cat_met    m on m.id = mv.metric_id
join public.cat_people p on p.id = mv.user_id;

-- Metric catalog plus when each metric was first/last recorded
-- (instrumentation was added in stages, e.g. view_/screen_/generated_ start 2026-11-10).
create view dashboard.v_metrics as
select m.id,
       m.code,
       m.name,
       m.unit,
       min(mv.occurred_at) as tracking_start,
       max(mv.occurred_at) as last_seen
from public.cat_met m
left join public.movements mv on mv.metric_id = m.id
group by m.id, m.code, m.name, m.unit;

-- One row per case: what happened to it in Zeeker over its whole life.
-- Note: counts for metrics tracked only since their tracking_start are 0 for
-- earlier activity, which does not mean the step didn't happen.
create view dashboard.v_case_journey as
select e.case_number,
       (array_agg(e.user_id order by e.occurred_at))[1]                                       as owner_id,
       array_agg(distinct e.user_id)                                                          as user_ids,
       min(e.occurred_at)                                                                     as first_seen_at,
       max(e.occurred_at)                                                                     as last_seen_at,
       min(e.occurred_at) filter (where e.metric_code = 'case_logged')                        as logged_at,
       bool_or(e.metric_code = 'case_removed')                                                as removed,
       max(e.occurred_at) filter (where e.metric_code = 'case_closed')                        as closed_at,
       max(e.value)       filter (where e.metric_code = 'case_closed')                        as ttr_hours,
       count(*) filter (where starts_with(e.metric_code, 'generated_research'))               as research_generated,
       count(*) filter (where e.metric_code = 're_research_confirmed')                        as re_research,
       count(*) filter (where starts_with(e.metric_code, 'generated_draft'))                  as drafts_generated,
       count(*) filter (where starts_with(e.metric_code, 'copy_draft'))                       as drafts_copied,
       count(*) filter (where starts_with(e.metric_code, 'generated_handoff'))                as handoffs_generated,
       count(*) filter (where starts_with(e.metric_code, 'copy_handoff'))                     as handoffs_copied,
       count(*) filter (where starts_with(e.metric_code, 'generated_gho'))                    as gho_generated,
       count(*) filter (where starts_with(e.metric_code, 'copy_gho'))                         as gho_copied,
       count(*) filter (where starts_with(e.metric_code, 'message_'))                         as messages,
       coalesce(sum(e.value) filter (where e.unit = 'seconds'), 0)                            as screen_seconds,
       count(*)                                                                               as events
from dashboard.v_events e
where e.case_number is not null
group by e.case_number;

-- Returns the display name if the credentials are valid, otherwise null.
create function dashboard.check_user(p_username text, p_password text)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(u.display_name, u.username)
  from dashboard.dashboard_users u
  where u.username = lower(btrim(p_username))
    and u.password_hash = extensions.crypt(p_password, u.password_hash);
$$;
revoke all on function dashboard.check_user(text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Public entry points (the only things the dashboard can call).
-- ---------------------------------------------------------------------------
create function public.dashboard_login(p_username text, p_password text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_name text := dashboard.check_user(p_username, p_password);
begin
  if v_name is null then
    raise exception 'invalid credentials' using errcode = '28P01';
  end if;
  return jsonb_build_object('username', lower(btrim(p_username)), 'name', v_name);
end;
$$;

-- Everything the dashboard needs for a date range, in one call.
--   p_from / p_to : inclusive calendar dates in p_tz
--   p_tz          : IANA time zone used to bucket days (e.g. 'America/Mexico_City')
create function public.dashboard_data(
  p_username text,
  p_password text,
  p_from     date,
  p_to       date,
  p_tz       text default 'UTC'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_end   timestamptz;
begin
  if dashboard.check_user(p_username, p_password) is null then
    raise exception 'invalid credentials' using errcode = '28P01';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid date range (max 366 days)';
  end if;

  -- Raises "time zone ... not recognized" for an invalid p_tz.
  v_start := p_from::timestamp at time zone p_tz;
  v_end   := (p_to + 1)::timestamp at time zone p_tz;

  return jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to, 'tz', p_tz),

    'people', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name), '[]'::jsonb)
      from public.cat_people p
    ),

    'metrics', (
      select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]'::jsonb)
      from dashboard.v_metrics m
    ),

    -- Day x person x metric aggregates within the range.
    'daily', (
      select coalesce(jsonb_agg(to_jsonb(d) order by d.day, d.user_id, d.metric_id), '[]'::jsonb)
      from (
        select (e.occurred_at at time zone p_tz)::date as day,
               e.user_id,
               e.metric_id,
               count(*)                       as events,
               sum(e.value)                   as value,
               count(distinct e.case_number)  as cases
        from dashboard.v_events e
        where e.occurred_at >= v_start
          and e.occurred_at <  v_end
        group by 1, 2, 3
      ) d
    ),

    -- Cases with any activity in the range (journey computed over the case's whole life).
    'cases', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.first_seen_at), '[]'::jsonb)
      from dashboard.v_case_journey c
      where c.last_seen_at  >= v_start
        and c.first_seen_at <  v_end
    )
  );
end;
$$;

-- Only the anon key (used by the static dashboard) may call these.
revoke all on function public.dashboard_login(text, text)                   from public, authenticated;
revoke all on function public.dashboard_data(text, text, date, date, text) from public, authenticated;
grant execute on function public.dashboard_login(text, text)                   to anon;
grant execute on function public.dashboard_data(text, text, date, date, text) to anon;
