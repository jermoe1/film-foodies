-- =============================================================================
-- Film Foodies — pg_cron Scheduled Jobs
-- =============================================================================
-- Run this in the Supabase SQL Editor after enabling the pg_cron extension.
-- pg_cron is available on Supabase Pro plans.
--
-- To enable pg_cron in the Supabase Dashboard:
--   Database → Extensions → search "pg_cron" → Enable
--
-- To view scheduled jobs:
--   SELECT * FROM cron.job;
--
-- To unschedule a job:
--   SELECT cron.unschedule('<job-name>');
-- =============================================================================

-- Prerequisite: enable pg_cron
create extension if not exists pg_cron;

-- ── 1. Reset OMDB daily call counter every day at midnight UTC ───────────────
--
-- Calls reset_omdb_daily_counter() which sets omdb_calls_today = 0 and
-- omdb_calls_reset_date = current_date on the app_settings row.

select cron.schedule(
  'reset-omdb-daily-counter',     -- job name (must be unique)
  '0 0 * * *',                    -- cron expression: midnight UTC every day
  $$select reset_omdb_daily_counter()$$
);

-- ── 2. Purge old discovery history weekly (Sunday 02:00 UTC) ─────────────────
--
-- Calls purge_old_discovery_history() which deletes discovery_history rows
-- older than a configurable retention period (default 90 days).
-- Safe to run even if the discovery_history table is empty.

select cron.schedule(
  'purge-old-discovery-history',  -- job name
  '0 2 * * 0',                    -- cron expression: 02:00 UTC every Sunday
  $$select purge_old_discovery_history()$$
);

-- ── Notes on the OMDB Refresh Edge Function ───────────────────────────────────
--
-- The omdb-refresh Edge Function is invoked via HTTP, not pg_cron, because
-- Supabase Edge Functions require an HTTP call with an Authorization header.
--
-- Recommended approach: invoke it monthly from a GitHub Actions cron job:
--
--   on:
--     schedule:
--       - cron: '0 3 1 * *'   # 03:00 UTC on the 1st of every month
--     workflow_dispatch:
--
--   jobs:
--     omdb-refresh:
--       runs-on: ubuntu-latest
--       steps:
--         - name: Trigger OMDB refresh
--           run: |
--             curl -s -X POST \
--               "${{ secrets.SUPABASE_URL }}/functions/v1/omdb-refresh" \
--               -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
--               -H "Content-Type: application/json"
--
-- Alternatively, pg_cron can invoke the function via net.http_post() if the
-- pg_net extension is enabled:
--
--   select cron.schedule(
--     'omdb-refresh-monthly',
--     '0 3 1 * *',
--     $$
--       select net.http_post(
--         url    := current_setting('app.supabase_url') || '/functions/v1/omdb-refresh',
--         headers := jsonb_build_object(
--           'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
--           'Content-Type', 'application/json'
--         ),
--         body   := '{}'::jsonb
--       )
--     $$
--   );
--
-- To use the pg_net approach: enable pg_net in Supabase Dashboard,
-- then set the two app settings:
--   alter database postgres set app.supabase_url = 'https://<project>.supabase.co';
--   alter database postgres set app.service_role_key = '<your-service-role-key>';
