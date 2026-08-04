-- 0001 created the `movies` schema, its tables, and RLS policies, but never granted the
-- base schema/table privileges — unlike `public`, a custom schema does NOT inherit the
-- anon/authenticated/service_role grants a new Supabase project sets up automatically.
-- Without these, Postgres rejects every request at the privilege check, before RLS
-- policies are even consulted (surfaces client-side as a 403 "permission denied",
-- regardless of how permissive the policies are).
grant usage on schema movies to authenticated, service_role;
grant all on all tables in schema movies to authenticated, service_role;
grant all on all sequences in schema movies to authenticated, service_role;

-- So any table added to this schema later (e.g. 0004's `events`) gets the same grants
-- automatically instead of silently 403ing until someone remembers to repeat this.
alter default privileges in schema movies grant all on tables to authenticated, service_role;
alter default privileges in schema movies grant all on sequences to authenticated, service_role;
