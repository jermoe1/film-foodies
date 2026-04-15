// supabase/functions/omdb-refresh/index.ts
// Deno Edge Function — refreshes stale OMDB data for cached movies.
//
// Invocation: POST https://<project>.supabase.co/functions/v1/omdb-refresh
// Authorization: Bearer <service_role_key>
//
// The function respects a daily OMDB call budget (DAILY_LIMIT).  It reads
// the current counter from app_settings, fetches up to BATCH_SIZE movies
// whose last_omdb_fetch is oldest (or NULL), then writes fresh data back.
// A 200 ms delay is inserted between OMDB calls to avoid rate-limit errors.
//
// Environment variables required (set in Supabase Dashboard → Edge Functions):
//   SUPABASE_URL         — project URL  (auto-injected by Supabase runtime)
//   SUPABASE_SERVICE_ROLE_KEY — service-role key (auto-injected)
//   OMDB_API_KEY         — your OMDB API key

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BATCH_SIZE  = 50;   // max movies to refresh per invocation
const DAILY_LIMIT = 500;  // conservative daily cap (OMDB allows 1 000/day)
const CALL_DELAY  = 200;  // ms between OMDB HTTP calls

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (_req) => {
  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const omdbApiKey      = Deno.env.get('OMDB_API_KEY');

  if (!omdbApiKey) {
    return new Response(JSON.stringify({ error: 'OMDB_API_KEY not set' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  const db = createClient(supabaseUrl, serviceRoleKey);

  // ── Read current daily usage ──────────────────────────────────────────────

  const { data: settings } = await db
    .from('app_settings')
    .select('omdb_calls_today, omdb_calls_reset_date, omdb_refresh_in_progress')
    .single();

  if (!settings) {
    return new Response(JSON.stringify({ error: 'Could not read app_settings' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Reset counter if it's a new day
  const today = new Date().toISOString().slice(0, 10);
  let callsToday: number = settings.omdb_calls_today;
  if (settings.omdb_calls_reset_date !== today) {
    callsToday = 0;
    await db
      .from('app_settings')
      .update({ omdb_calls_today: 0, omdb_calls_reset_date: today })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // update all rows
  }

  const remaining = DAILY_LIMIT - callsToday;
  if (remaining <= 0) {
    return new Response(JSON.stringify({ skipped: true, reason: 'Daily OMDB limit reached' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Mark refresh in progress ──────────────────────────────────────────────

  await db
    .from('app_settings')
    .update({ omdb_refresh_in_progress: true })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  // ── Fetch stale movies ────────────────────────────────────────────────────

  const limit = Math.min(BATCH_SIZE, remaining);

  const { data: movies, error: fetchError } = await db
    .from('movies')
    .select('id, imdb_id, title')
    .not('imdb_id', 'is', null)
    .order('last_omdb_fetch', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (fetchError || !movies) {
    await db
      .from('app_settings')
      .update({ omdb_refresh_in_progress: false })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    return new Response(JSON.stringify({ error: fetchError?.message ?? 'No movies found' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Refresh each movie ────────────────────────────────────────────────────

  let refreshed = 0;
  let errors = 0;

  for (const movie of movies) {
    try {
      const url = `https://www.omdbapi.com/?apikey=${omdbApiKey}&i=${movie.imdb_id}&plot=short`;
      const resp = await fetch(url);
      const data = await resp.json();

      if (data.Response === 'True') {
        await db
          .from('movies')
          .update({
            title:          data.Title,
            release_year:   data.Year   ?? null,
            imdb_url:       `https://www.imdb.com/title/${movie.imdb_id}/`,
            poster_url:     data.Poster !== 'N/A' ? data.Poster : null,
            genre:          data.Genre  !== 'N/A' ? data.Genre  : null,
            director:       data.Director !== 'N/A' ? data.Director : null,
            movie_cast:     data.Actors !== 'N/A' ? data.Actors : null,
            runtime:        data.Runtime !== 'N/A' ? data.Runtime : null,
            imdb_rating:    data.imdbRating !== 'N/A' ? data.imdbRating : null,
            country:        data.Country !== 'N/A' ? data.Country : null,
            movie_language: data.Language !== 'N/A' ? data.Language : null,
            raw_omdb:       data,
            last_omdb_fetch: new Date().toISOString(),
          })
          .eq('id', movie.id);

        refreshed++;
      } else {
        errors++;
      }

      // Increment daily counter after each call
      callsToday++;
      await db
        .from('app_settings')
        .update({ omdb_calls_today: callsToday })
        .neq('id', '00000000-0000-0000-0000-000000000000');

    } catch (_e) {
      errors++;
    }

    await sleep(CALL_DELAY);
  }

  // ── Mark refresh complete ─────────────────────────────────────────────────

  await db
    .from('app_settings')
    .update({ omdb_refresh_in_progress: false })
    .neq('id', '00000000-0000-0000-0000-000000000000');

  return new Response(
    JSON.stringify({ refreshed, errors, callsToday, remaining: DAILY_LIMIT - callsToday }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
