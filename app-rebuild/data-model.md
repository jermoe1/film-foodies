# Data Model

> **Persona Discussion**
>
> **DBA:** The existing schema is mostly solid but has two normalization issues I'd fix in a rebuild. First, `movies.movie_cast` is a comma-separated string — this makes actor-level queries slow and forces client-side parsing. A proper `movie_actors` junction table would make profile stats cleaner and eliminate the "cap at 4 actors" hack. Second, there's no explicit `user_preferences` table, so per-member settings like theme preference don't exist (theme is stored as a single localStorage key, meaning it's device-bound, not member-bound). A preferences table would be a small investment with real UX payoff.
>
> **Dev:** Agreed on normalization. I'd also flag that there are no documented indexes beyond primary keys. `ratings(member_id)`, `ratings(movie_night_id)`, `movie_night_attendees(member_id)`, and `movie_suggestions(deleted_at)` are all heavily queried without explicit indexes. At small scale it doesn't matter — at 500+ rows it will.
>
> **PO:** From a product standpoint, I want to make sure `fun_facts` is retained — that trivia tab in History is underused but members love it when facts are there. Also make sure the `app_settings` table single-row pattern is documented clearly. There is one and only one row in that table — it's a config store, not a proper entity table.
>
> **QA:** The `movie_night_attendees` trigger is the scariest data integrity issue. I'd strongly recommend adding a database-level constraint or test that validates: every movie night must have at least one attendee. Right now the trigger fires correctly, but if it's ever disabled or a migration deletes it, the entire app silently breaks. A `CHECK` constraint won't help here, but an integration test that creates a movie night and asserts attendee rows exist would.
>
> **DBA:** One more thing: Supabase RLS (Row Level Security) is not explicitly documented anywhere in the codebase. Since this is a public-ish app with just an anon key, the anon key's access needs to be carefully scoped. In a rebuild, we should define exactly which tables the anon key can read vs. write, and document that here.
>
> **User:** I've noticed that when I look at my profile, the "top actors" list sometimes shows weird abbreviations for names I recognize. Knowing that this is a "cap at 4 + abbreviate at 15 chars" rule makes me less confused. Still annoying though — full names in a proper actors table would be nicer.

---

## Tables

### `members`
The core identity table. One row per group member. No auth — members are UI-only identities.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default gen_random_uuid() | |
| `full_name` | text | NOT NULL | e.g. "Jerry Moe" |
| `first_name` | text | NOT NULL | e.g. "Jerry" — used in UI display |
| `avatar_color` | text | NOT NULL | Hex string from AVATAR_COLORS set |
| `display_order` | integer | NOT NULL | Admin-managed ordering; used in all member lists |
| `is_admin` | boolean | NOT NULL, default false | Unlocks admin-only UI sections |
| `created_at` | timestamptz | NOT NULL, default now() | |

**Avatar Colors (valid set):**
`#C8860A`, `#C04040`, `#4070D0`, `#40A060`, `#A040C0`, `#40A0C0`, `#C07040`, `#8060C0`

**Indexes:** Primary key only. Consider index on `display_order` if group grows large.

**RLS:** Anon key should be able to SELECT all members. INSERT/UPDATE reserved for admin-authenticated sessions (or open to anon in a trusted-group context).

---

### `movies`
The canonical movie record. Populated from OMDB API on first cache. Never deleted (soft or hard) — movies are referenced by other tables indefinitely.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default gen_random_uuid() | |
| `title` | text | NOT NULL | From OMDB |
| `release_year` | text | nullable | String from OMDB (e.g. "2019") |
| `imdb_id` | text | UNIQUE, NOT NULL | e.g. "tt9764362" |
| `imdb_url` | text | nullable | Full IMDB URL |
| `poster_url` | text | nullable | OMDB poster URL |
| `genre` | text | nullable | Comma-separated string, e.g. "Horror, Comedy" |
| `director` | text | nullable | From OMDB |
| `movie_cast` | text | nullable | Comma-separated actor names from OMDB |
| `runtime` | text | nullable | e.g. "106 min" |
| `imdb_rating` | text | nullable | e.g. "7.6" as string |
| `country` | text | nullable | From OMDB |
| `movie_language` | text | nullable | e.g. "English" or "Korean, English" |
| `content_warnings` | jsonb | nullable, default '[]' | Array of ContentWarning objects |
| `raw_omdb` | jsonb | nullable | Full raw OMDB response (for debugging/re-parsing) |
| `last_omdb_fetch` | timestamptz | nullable | When OMDB was last queried for this movie |
| `created_at` | timestamptz | NOT NULL, default now() | |

**ContentWarning JSONB shape:**
```json
[
  { "warning": "Violence", "severity": "moderate", "source": "doesthedogdie.com", "source_url": "https://..." }
]
```
**Severity values:** `"mild"` | `"moderate"` | `"severe"`

**Indexes:**
- UNIQUE on `imdb_id` (existing, critical for dedup)
- GIN index on `title` for full-text or ilike search performance (recommended in rebuild)

**Rebuild recommendation:** Extract `movie_cast` into a `movie_actors` junction table:
```sql
CREATE TABLE movie_actors (
  movie_id uuid REFERENCES movies(id) ON DELETE CASCADE,
  actor_name text NOT NULL,
  position integer NOT NULL,  -- order in OMDB cast list (1-based)
  PRIMARY KEY (movie_id, position)
);
```

---

### `movie_nights`
A logged movie watching event. One row per screening.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default gen_random_uuid() | |
| `movie_id` | uuid | FK → movies(id), NOT NULL | |
| `suggestion_id` | uuid | FK → movie_suggestions(id), nullable | Set if night originated from suggestions queue |
| `host_id` | uuid | FK → members(id), NOT NULL | Who hosted |
| `date` | date | NOT NULL | YYYY-MM-DD — parse as local time, not UTC |
| `food_main` | text | nullable | Main dish description |
| `food_sides` | text | nullable | Sides description |
| `food_drinks` | text | nullable | Drinks description |
| `watch_platform` | text | nullable | e.g. "Netflix", "Blu-Ray" |
| `cut_version` | text | nullable | e.g. "Director's Cut", "Theatrical" |
| `subtitle_option` | text | nullable | e.g. "English subtitles", "No subtitles" |
| `viewing_environment` | text[] | NOT NULL, default '{}' | Array, e.g. ["Projector", "Large TV"] |
| `photo_url` | text | nullable | URL to group photo |
| `created_by` | uuid | FK → members(id), nullable | Who logged the night |
| `created_at` | timestamptz | NOT NULL, default now() | |

**Trigger (must exist in schema):**
```sql
-- After INSERT on movie_nights:
-- INSERT INTO movie_night_attendees (movie_night_id, member_id, attended)
-- SELECT NEW.id, m.id, true FROM members m;
```

**Indexes:**
- FK indexes on `movie_id`, `host_id`, `suggestion_id`, `created_by`
- Index on `date DESC` for history queries

---

### `movie_night_attendees`
Who was present at each movie night. Auto-populated by trigger; app patches non-attending rows.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `movie_night_id` | uuid | PK (composite), FK → movie_nights(id) ON DELETE CASCADE | |
| `member_id` | uuid | PK (composite), FK → members(id) | |
| `attended` | boolean | NOT NULL, default true | False = member was absent |

**Indexes:**
- Composite PK on `(movie_night_id, member_id)`
- Index on `member_id` for profile queries

---

### `ratings`
A member's score and review for a movie night. One row per member per night (upsert semantics).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `movie_night_id` | uuid | PK (composite), FK → movie_nights(id) ON DELETE CASCADE | |
| `member_id` | uuid | PK (composite), FK → members(id) | |
| `score` | numeric(3,1) | NOT NULL, CHECK (score >= 0 AND score <= 10) | 0.0–10.0 |
| `first_watch` | boolean | nullable | True if member had never seen the movie before |
| `review_note` | text | nullable | Optional free-text review |
| `tags` | text[] | NOT NULL, default '{}' | From PRESET_TAGS list |
| `created_at` | timestamptz | NOT NULL, default now() | |

**PRESET_TAGS (valid values):**
`"Laughed out loud"`, `"Cried"`, `"Great ending"`, `"Slow burn"`, `"Fell asleep"`, `"Would rewatch"`, `"Disturbing"`, `"Hidden gem"`

**Indexes:**
- Composite PK on `(movie_night_id, member_id)`
- Index on `member_id` for profile and stats queries

---

### `movie_suggestions`
The suggestion queue. Uses soft deletes to enable undo.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default gen_random_uuid() | |
| `movie_id` | uuid | FK → movies(id), NOT NULL | |
| `suggested_by` | uuid | FK → members(id), NOT NULL | |
| `status` | text | NOT NULL, default 'pending' | `'pending'` or `'selected'` |
| `manual_warnings` | text[] | NOT NULL, default '{}' | Free-text warnings entered by suggester |
| `deleted_at` | timestamptz | nullable | Non-null = soft deleted; queries must filter `.is('deleted_at', null)` |
| `created_at` | timestamptz | NOT NULL, default now() | |

**Indexes:**
- FK index on `movie_id`, `suggested_by`
- Index on `deleted_at` (partial index WHERE deleted_at IS NULL recommended for performance)
- Index on `status` for queue filtering

---

### `suggestion_votes`
Upvotes and downvotes on the suggestions queue. One vote per member per suggestion.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `suggestion_id` | uuid | PK (composite), FK → movie_suggestions(id) ON DELETE CASCADE | |
| `member_id` | uuid | PK (composite), FK → members(id) | |
| `vote` | text | NOT NULL | `'up'` or `'down'` |
| `created_at` | timestamptz | NOT NULL, default now() | |

**Constraint:** UNIQUE on `(suggestion_id, member_id)` — enforced by PK.

---

### `movie_night_notes`
Free-text notes attached to a movie night, by member. Supports edit (trigger sets is_edited).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default gen_random_uuid() | |
| `movie_night_id` | uuid | FK → movie_nights(id) ON DELETE CASCADE, NOT NULL | |
| `member_id` | uuid | FK → members(id), NOT NULL | |
| `note_text` | text | NOT NULL | The note content |
| `is_edited` | boolean | NOT NULL, default false | Set to true by trigger on UPDATE |
| `created_at` | timestamptz | NOT NULL, default now() | |

**Trigger (must exist in schema):**
```sql
-- After UPDATE on movie_night_notes:
-- SET is_edited = true WHERE id = NEW.id;
```

---

### `fun_facts`
Trivia facts about movies, shown in History detail tab. Manually curated or imported.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK, default gen_random_uuid() | |
| `movie_id` | uuid | FK → movies(id) ON DELETE CASCADE, NOT NULL | |
| `fact_text` | text | NOT NULL | The trivia text |
| `source_url` | text | nullable | URL to source (IMDB, Wikipedia, etc.) |
| `source_label` | text | nullable | Display label for source link |
| `created_at` | timestamptz | NOT NULL, default now() | |

---

### `app_settings`
Single-row configuration table. Always has exactly one row (id = fixed UUID or check constraint).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | uuid | PK | Single fixed row |
| `passcode_hash` | text | nullable | SHA-256 hex of the group passcode |
| `omdb_calls_today` | integer | NOT NULL, default 0 | Incremented on each OMDB API call |
| `omdb_refresh_in_progress` | boolean | NOT NULL, default false | Flag for bulk refresh operations |
| `updated_at` | timestamptz | NOT NULL, default now() | |

**Note:** This is a config store — not a proper entity. Always query with `.limit(1)`. Consider a trigger that prevents a second row from being inserted.

---

## Recommended New Table (Rebuild Addition)

### `member_preferences` *(new in rebuild)*
Per-member UI preferences, stored in DB instead of localStorage. Allows preferences to follow the member across devices.

| Column | Type | Notes |
|--------|------|-------|
| `member_id` | uuid | PK, FK → members(id) |
| `theme` | text | One of the 6 theme names; default 'cinema' |
| `updated_at` | timestamptz | |

---

## Supabase RPC Functions

### `bulk_import_movie_nights(rows jsonb) → jsonb`
Atomic bulk insert of multiple movie nights with their movies. Called from BulkImportService.
- Input: array of enriched row objects (movie data + night metadata)
- Output: `{ imported: number, errors: string[] }`
- Must be executed with service-role key or appropriate RLS bypass

---

## Entity Relationship Summary

```
members ─────────────────────────────────────────────────────┐
  │ (host_id)                                                 │
  │ (created_by)                                              │
  │                                                           │
movie_nights ──(movie_id)──── movies ──(id)── movie_actors*  │
  │  │  │                       │                            │
  │  │  └─(suggestion_id)       └── fun_facts                │
  │  │                          └── content_warnings (jsonb) │
  │  └── movie_night_attendees ──────(member_id)─────────────┤
  │       [auto-populated by trigger]                         │
  │                                                           │
  └── movie_night_notes ──────────(member_id)────────────────┤
  └── ratings ────────────────────(member_id)────────────────┘
                                                              │
movie_suggestions ──(movie_id)── movies                      │
  │  └─(suggested_by)──────────────────────────────────(members)
  └── suggestion_votes ──────────(member_id)────────────────┘

app_settings [singleton]
member_preferences* [new in rebuild]

* = recommended additions for rebuild
```

---

## TypeScript Interface Reference

All interfaces are defined in the services/components that use them. In a rebuild, consolidate into a `src/app/core/models/` folder.

```typescript
// members
interface Member {
  id: string;
  full_name: string;
  first_name: string;
  avatar_color: string;
  display_order: number;
  is_admin: boolean;
  created_at: string;
}

// movies
interface Movie {
  id: string;
  title: string;
  release_year: string | null;
  imdb_id: string;
  imdb_url: string | null;
  poster_url: string | null;
  genre: string | null;
  director: string | null;
  movie_cast: string | null;       // comma-separated; normalize in rebuild
  runtime: string | null;
  imdb_rating: string | null;      // stored as string, parse to float when needed
  country: string | null;
  movie_language: string | null;
  content_warnings: ContentWarning[];
}

interface ContentWarning {
  warning: string;
  severity: 'mild' | 'moderate' | 'severe';
  source: string;
  source_url: string;
}

// ratings
interface Rating {
  movie_night_id: string;
  member_id: string;
  score: number;                   // 0.0–10.0
  first_watch: boolean | null;
  review_note: string | null;
  tags: string[];
  created_at: string;
}

// suggestions
interface Suggestion {
  id: string;
  movie_id: string;
  suggested_by: string;
  status: 'pending' | 'selected';
  manual_warnings: string[];
  deleted_at: string | null;
  created_at: string;
}

// app settings
interface AppSettings {
  id: string;
  passcode_hash: string | null;
  omdb_calls_today: number;
  omdb_refresh_in_progress: boolean;
  updated_at: string;
}
```
