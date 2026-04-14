-- =============================================================================
-- Film Foodies — Supabase Database Setup Script
-- Version: 1.4
-- Run this entire script in the Supabase SQL Editor to initialize the database
-- =============================================================================


-- =============================================================================
-- EXTENSIONS
-- =============================================================================

create extension if not exists "uuid-ossp";


-- =============================================================================
-- TABLES
-- =============================================================================

-- Members
create table if not exists members (
  id            uuid primary key default uuid_generate_v4(),
  full_name      text not null,
  first_name    text not null,
  avatar_color  text not null default '#C8860A',
  display_order integer not null default 0,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Movies (merged with OMDB cache)
create table if not exists movies (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  release_year       text,
  imdb_id           text unique,
  imdb_url          text,
  poster_url        text,
  genre             text,
  director          text,
  movie_cast         text,
  runtime           text,
  imdb_rating       text,
  country           text,
  movie_language     text,
  raw_omdb          jsonb,
  content_warnings  jsonb default '[]'::jsonb,
  last_omdb_fetch   timestamptz,
  created_at        timestamptz not null default now()
);

-- App Settings (single row)
create table if not exists app_settings (
  id                          uuid primary key default uuid_generate_v4(),
  passcode_hash               text,
  rating_scale                text not null default 'numeric_10',
  theme                       text not null default 'cinema',
  omdb_calls_today            integer not null default 0,
  omdb_calls_reset_date       date not null default current_date,
  omdb_refresh_in_progress    boolean not null default false,
  omdb_refresh_last_movie_id  uuid references movies(id),
  updated_at                  timestamptz not null default now()
);

-- Movie Suggestions
create table if not exists movie_suggestions (
  id            uuid primary key default uuid_generate_v4(),
  movie_id      uuid not null references movies(id) on delete cascade,
  suggested_by  uuid not null references members(id) on delete cascade,
  suggested_at  timestamptz not null default now(),
  status        text not null default 'pending' check (status in ('pending', 'selected', 'watched')),
  up_votes      integer not null default 0,
  down_votes    integer not null default 0,
  manual_warnings text[] default '{}',
  deleted_at    timestamptz
);

-- Suggestion Votes
create table if not exists suggestion_votes (
  id             uuid primary key default uuid_generate_v4(),
  suggestion_id  uuid not null references movie_suggestions(id) on delete cascade,
  member_id      uuid not null references members(id) on delete cascade,
  vote           text not null check (vote in ('up', 'down')),
  voted_at       timestamptz not null default now(),
  unique (suggestion_id, member_id)
);

-- Movie Nights
create table if not exists movie_nights (
  id                  uuid primary key default uuid_generate_v4(),
  movie_id            uuid not null references movies(id) on delete cascade,
  suggestion_id       uuid references movie_suggestions(id) on delete set null,
  host_id             uuid not null references members(id) on delete cascade,
  date                date not null,
  food_main           text,
  food_sides          text,
  food_drinks         text,
  watch_platform      text,
  cut_version         text default 'Standard',
  subtitle_option     text,
  viewing_environment text[] default '{}',
  photo_url           text,
  created_by          uuid not null references members(id) on delete cascade,
  created_at          timestamptz not null default now()
);

-- Movie Night Attendees
create table if not exists movie_night_attendees (
  id              uuid primary key default uuid_generate_v4(),
  movie_night_id  uuid not null references movie_nights(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  attended        boolean not null default true,
  created_at      timestamptz not null default now(),
  unique (movie_night_id, member_id)
);

-- Ratings
create table if not exists ratings (
  id              uuid primary key default uuid_generate_v4(),
  movie_night_id  uuid not null references movie_nights(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  score           numeric(3,1) check (score >= 0.0 and score <= 10.0),
  review_note     text,
  tags            text[] default '{}',
  first_watch     boolean,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (movie_night_id, member_id)
);

-- Movie Night Notes (forum thread)
create table if not exists movie_night_notes (
  id              uuid primary key default uuid_generate_v4(),
  movie_night_id  uuid not null references movie_nights(id) on delete cascade,
  member_id       uuid not null references members(id) on delete cascade,
  note_text       text not null,
  is_edited       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Fun Facts (Trivia)
create table if not exists fun_facts (
  id            uuid primary key default uuid_generate_v4(),
  movie_id      uuid not null references movies(id) on delete cascade,
  fact_text     text not null,
  source_url    text,
  source_label  text,
  created_at    timestamptz not null default now()
);

-- Discovery History
create table if not exists discovery_history (
  id         uuid primary key default uuid_generate_v4(),
  member_id  uuid not null references members(id) on delete cascade,
  movie_id   uuid not null references movies(id) on delete cascade,
  shown_at   timestamptz not null default now()
);

-- Member Ignores (Discovery)
create table if not exists member_ignores (
  id         uuid primary key default uuid_generate_v4(),
  member_id  uuid not null references members(id) on delete cascade,
  movie_id   uuid not null references movies(id) on delete cascade,
  ignored_at timestamptz not null default now(),
  unique (member_id, movie_id)
);


-- =============================================================================
-- INDEXES
-- =============================================================================

create index if not exists idx_movies_imdb_id
  on movies (imdb_id);

create index if not exists idx_movie_suggestions_status
  on movie_suggestions (status);

create index if not exists idx_movie_suggestions_deleted_at
  on movie_suggestions (deleted_at);

create index if not exists idx_movie_suggestions_suggested_by
  on movie_suggestions (suggested_by);

create index if not exists idx_movie_nights_date
  on movie_nights (date);

create index if not exists idx_movie_nights_host_id
  on movie_nights (host_id);

create index if not exists idx_movie_night_attendees_movie_night_id
  on movie_night_attendees (movie_night_id);

create index if not exists idx_movie_night_attendees_member_id
  on movie_night_attendees (member_id);

create index if not exists idx_ratings_movie_night_id
  on ratings (movie_night_id);

create index if not exists idx_ratings_member_id
  on ratings (member_id);

create index if not exists idx_fun_facts_movie_id
  on fun_facts (movie_id);

create index if not exists idx_movie_night_notes_movie_night_id
  on movie_night_notes (movie_night_id);

create index if not exists idx_discovery_history_member_id
  on discovery_history (member_id);

create index if not exists idx_member_ignores_member_id
  on member_ignores (member_id);


-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-populate movie_night_attendees when a movie night is created
create or replace function populate_movie_night_attendees()
returns trigger as $$
begin
  insert into movie_night_attendees (movie_night_id, member_id, attended)
  select new.id, m.id, true
  from members m
  where not exists (
    select 1 from movie_night_attendees a
    where a.movie_night_id = new.id and a.member_id = m.id
  );
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_populate_attendees on movie_nights;
create trigger trg_populate_attendees
  after insert on movie_nights
  for each row execute function populate_movie_night_attendees();

-- Auto-update updated_at on ratings
create or replace function update_ratings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_ratings_updated_at on ratings;
create trigger trg_ratings_updated_at
  before update on ratings
  for each row execute function update_ratings_updated_at();

-- Auto-update updated_at on movie_night_notes
create or replace function update_notes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  new.is_edited = true;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_notes_updated_at on movie_night_notes;
create trigger trg_notes_updated_at
  before update on movie_night_notes
  for each row execute function update_notes_updated_at();

-- Auto-update updated_at on app_settings
create or replace function update_app_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_app_settings_updated_at on app_settings;
create trigger trg_app_settings_updated_at
  before update on app_settings
  for each row execute function update_app_settings_updated_at();

-- Keep up_votes / down_votes counts in sync on suggestion_votes
create or replace function sync_suggestion_vote_counts()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    if new.vote = 'up' then
      update movie_suggestions set up_votes = up_votes + 1 where id = new.suggestion_id;
    else
      update movie_suggestions set down_votes = down_votes + 1 where id = new.suggestion_id;
    end if;
  elsif (tg_op = 'DELETE') then
    if old.vote = 'up' then
      update movie_suggestions set up_votes = greatest(up_votes - 1, 0) where id = old.suggestion_id;
    else
      update movie_suggestions set down_votes = greatest(down_votes - 1, 0) where id = old.suggestion_id;
    end if;
  elsif (tg_op = 'UPDATE') then
    if old.vote = 'up' and new.vote = 'down' then
      update movie_suggestions
        set up_votes = greatest(up_votes - 1, 0), down_votes = down_votes + 1
        where id = new.suggestion_id;
    elsif old.vote = 'down' and new.vote = 'up' then
      update movie_suggestions
        set down_votes = greatest(down_votes - 1, 0), up_votes = up_votes + 1
        where id = new.suggestion_id;
    end if;
  end if;
  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_vote_counts on suggestion_votes;
create trigger trg_sync_vote_counts
  after insert or update or delete on suggestion_votes
  for each row execute function sync_suggestion_vote_counts();


-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on app_settings to prevent deletion
alter table app_settings enable row level security;

-- Allow reads for all (authenticated or anon via API key)
create policy "Allow read app_settings"
  on app_settings for select
  using (true);

-- Allow updates but never deletes
create policy "Allow update app_settings"
  on app_settings for update
  using (true);

-- No delete policy = deletion blocked at RLS level


-- =============================================================================
-- BULK IMPORT RPC (Postgres Transaction Wrapper)
-- =============================================================================

create or replace function bulk_import_movie_nights(nights jsonb)
returns jsonb as $$
declare
  night jsonb;
  movie_id uuid;
  night_id uuid;
  result jsonb := '{"success": true, "imported": 0}'::jsonb;
  imported_count integer := 0;
begin
  for night in select * from jsonb_array_elements(nights)
  loop
    -- Look up or create movie
    select id into movie_id from movies where imdb_id = (night->>'imdb_id');

    if movie_id is null then
      insert into movies (title, release_year, imdb_id, imdb_url, poster_url, genre, director, movie_cast, runtime, imdb_rating, country, movie_language)
      values (
        night->>'title', night->>'release_year', night->>'imdb_id', night->>'imdb_url',
        night->>'poster_url', night->>'genre', night->>'director', night->>'movie_cast',
        night->>'runtime', night->>'imdb_rating', night->>'country', night->>'movie_language'
      )
      returning id into movie_id;
    end if;

    -- Insert movie night
    insert into movie_nights (movie_id, host_id, date, food_main, food_sides, food_drinks, watch_platform, cut_version, subtitle_option, photo_url, created_by)
    values (
      movie_id,
      (night->>'host_id')::uuid,
      (night->>'date')::date,
      night->>'food_main',
      night->>'food_sides',
      night->>'food_drinks',
      night->>'watch_platform',
      coalesce(night->>'cut_version', 'Standard'),
      night->>'subtitle_option',
      night->>'photo_url',
      (night->>'created_by')::uuid
    )
    returning id into night_id;

    -- Insert ratings if provided
    if night->'ratings' is not null then
      insert into ratings (movie_night_id, member_id, score, review_note, first_watch)
      select
        night_id,
        (r->>'member_id')::uuid,
        (r->>'score')::numeric,
        r->>'review_note',
        (r->>'first_watch')::boolean
      from jsonb_array_elements(night->'ratings') as r;
    end if;

    imported_count := imported_count + 1;
  end loop;

  return jsonb_build_object('success', true, 'imported', imported_count);

exception when others then
  raise exception 'Bulk import failed: %', sqlerrm;
end;
$$ language plpgsql;


-- =============================================================================
-- SEED DATA
-- =============================================================================

-- Seed app_settings (single row)
insert into app_settings (rating_scale, theme)
values ('numeric_10', 'cinema')
on conflict do nothing;

-- Seed admin member (Jerry)
-- Other members to be added via the admin screen after first login
insert into members (full_name, first_name, avatar_color, display_order, is_admin)
values ('Jerry', 'Jerry', '#C8860A', 1, true)
on conflict do nothing;

-- Placeholder members (rename via Settings > Admin after launch)
insert into members (full_name, first_name, avatar_color, display_order, is_admin)
values
  ('Member2', 'Member2', '#8B1A1A', 2, false),
  ('Member3', 'Member3', '#1A2A4A', 3, false),
  ('Member4', 'Member4', '#4A8B2A', 4, false),
  ('Member5', 'Member5', '#5A2A8B', 5, false),
  ('Member6', 'Member6', '#B8730A', 6, false)
on conflict do nothing;


-- =============================================================================
-- DISCOVERY HISTORY CLEANUP FUNCTION
-- (Call periodically via Supabase scheduled Edge Function)
-- =============================================================================

create or replace function purge_old_discovery_history()
returns void as $$
begin
  delete from discovery_history
  where shown_at < now() - interval '90 days';
end;
$$ language plpgsql;


-- =============================================================================
-- OMDB DAILY CALL COUNTER RESET FUNCTION
-- (Call daily at midnight EST via Supabase scheduled Edge Function)
-- =============================================================================

create or replace function reset_omdb_daily_counter()
returns void as $$
begin
  update app_settings
  set omdb_calls_today = 0,
      omdb_calls_reset_date = current_date;
end;
$$ language plpgsql;


-- =============================================================================
-- HELPFUL VIEWS
-- =============================================================================

-- Active suggestions (excludes soft-deleted)
create or replace view active_suggestions as
select
  ms.*,
  m.title,
  m.release_year,
  m.poster_url,
  m.genre,
  m.director,
  m.runtime,
  m.imdb_rating,
  m.imdb_url,
  m.movie_language,
  m.country,
  m.content_warnings,
  mem.first_name as suggested_by_name,
  mem.avatar_color as suggested_by_color
from movie_suggestions ms
join movies m on ms.movie_id = m.id
join members mem on ms.suggested_by = mem.id
where ms.deleted_at is null;

-- Movie nights with host name and movie title
create or replace view movie_nights_detail as
select
  mn.*,
  m.title,
  m.release_year,
  m.poster_url,
  m.genre,
  m.director,
  m.movie_cast,
  m.runtime,
  m.imdb_rating,
  m.imdb_url,
  m.movie_language,
  m.country,
  m.content_warnings,
  host.first_name as host_name,
  host.avatar_color as host_color
from movie_nights mn
join movies m on mn.movie_id = m.id
join members host on mn.host_id = host.id
order by mn.date desc;

-- Ratings with member name and movie title
create or replace view ratings_detail as
select
  r.*,
  mem.first_name as member_name,
  mem.avatar_color as member_color,
  mn.date as movie_night_date,
  m.title as movie_title,
  m.poster_url
from ratings r
join members mem on r.member_id = mem.id
join movie_nights mn on r.movie_night_id = mn.id
join movies m on mn.movie_id = m.id;


-- =============================================================================
-- DONE
-- =============================================================================
-- Run this script once in Supabase SQL Editor (Database > SQL Editor > New Query)
-- After running:
--   1. Go to Settings > API to get your Project URL and anon/publishable key
--   2. Enter those keys in the Film Foodies app config screen on first launch
--   3. Rename placeholder members in Settings > Admin
--   4. Set your site passcode in Settings
-- =============================================================================
