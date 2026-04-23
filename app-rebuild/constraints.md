# Constraints

> **Persona Discussion**
>
> **Dev:** The single biggest gotcha for any rebuild is forgetting the HashLocationStrategy. Every route is `/#/route` — not `/route`. GitHub Pages can't serve 404.html redirects cleanly for SPA routing, so we're locked into hash-based routing. Any router configuration that omits `useHash: true` (or the standalone equivalent) will result in blank pages on direct URL load or refresh.
>
> **DBA:** From the data side, the most dangerous constraint is the movie_night_attendees auto-population trigger. When you INSERT a movie night, a Postgres trigger fires and creates one row per member in the attendees table — all marked attended=true by default. The form then patches non-attending members to attended=false. If you rebuild the backend without restoring this trigger, the form submit flow silently succeeds but no attendee records exist, which breaks every downstream query that joins attendees.
>
> **DBA:** Similarly, the `is_edited` flag on `movie_night_notes` is set by a Postgres trigger on UPDATE, not by the application. If you rebuild and update notes directly, you'll never see the edited flag unless the trigger exists.
>
> **PO:** The biggest product constraint is the Discovery feature labelling rule: never call it "AI" anywhere in the UI. Several members are AI-averse. The feature must be labelled "Discover Movies" throughout. This is non-negotiable.
>
> **UX:** Mobile is the primary use case — people are sitting on a couch with their phones. The full-screen layout needs `height: 100dvh` and `padding-bottom: env(safe-area-inset-bottom)` on every full-height component. Without this, the bottom panel is cut off on iOS Safari. The viewport meta tag must include `viewport-fit=cover`. Miss this and the Home screen panels look broken on iPhones.
>
> **QA:** The date parsing utility is a silent failure mode. `new Date('YYYY-MM-DD')` is parsed as UTC midnight in browsers, which means in timezones west of UTC (most of the US) the date appears as the previous day. The fix is `new Date(year, month-1, day)` using the local constructor. This must be a shared utility from day one — if developers use `new Date(dateString)` anywhere, movie night dates will be off by one.
>
> **QA:** The OMDB search strategy has a quirk: the app searches the local DB first (ilike `%title%`), and only calls OMDB if fewer than 3 results are returned. This means if the DB already has 3+ matching entries, no OMDB call is made even if the user is searching for something new. Rebuilding this search logic wrong could cause 1,000 OMDB calls/day to be burned unnecessarily.
>
> **User:** I always forget my passcode after a few weeks. The 6-digit PIN works fine but there's no recovery path if the admin forgets — you have to go update the database directly. Worth noting that as a known gap.
>
> **Dev:** The `movie_cast` column is a comma-separated string from OMDB, not a relational array. Queries that need actor stats (ProfileService.getTopActors) split the string client-side, cap at 4 actors per film (OMDB sometimes lists 10+), and abbreviate names over 15 characters. This is a significant data quality issue — any rebuild that normalizes actors into a proper table will need a migration strategy.
>
> **Dev:** All stats computations (StatsService, ProfileService) are done entirely client-side after fetching raw data. This means loading all movie nights + all ratings + all members in one shot. Works fine now, but will not scale past ~500 movie nights without server-side aggregation. Flag this for a rebuild.

---

## Hard Constraints (Must Reproduce Exactly)

### 1. Hash-Based Routing
- **Requirement:** All routes must use `HashLocationStrategy` (Angular) or equivalent hash-based router
- **URL pattern:** `/#/route`, e.g. `/#/history`, `/#/suggest/new`
- **Why:** GitHub Pages static hosting cannot perform server-side URL rewrites. Without hash routing, any direct URL load or page refresh results in a 404.
- **In rebuild:** Configure Angular router with `{ useHash: true }` or equivalent in standalone config

### 2. Postgres Trigger — Auto-Populate Movie Night Attendees
- **Table affected:** `movie_night_attendees`
- **Trigger fires on:** `INSERT` into `movie_nights`
- **Behavior:** Creates one row per member in `movie_night_attendees` with `attended = true`
- **Why this matters:** The form flow depends on all members being pre-populated. The app only updates the `attended = false` rows for non-attending members after creation — it never inserts attendee rows itself.
- **In rebuild:** Trigger must be recreated in Supabase. Do not attempt to insert attendee rows from the application layer.

### 3. Postgres Trigger — Note Edit Flag
- **Table affected:** `movie_night_notes`
- **Trigger fires on:** `UPDATE` on `note_text`
- **Behavior:** Sets `is_edited = true`
- **Why this matters:** The "edited" indicator shown in History is powered by this trigger. App-layer note updates never explicitly set `is_edited`.
- **In rebuild:** Restore this trigger in Supabase schema.

### 4. Soft Deletes on Movie Suggestions
- **Column:** `movie_suggestions.deleted_at` (timestamp, nullable)
- **Behavior:** Deletions set `deleted_at = now()`, never remove the row
- **Why:** Enables 5-second undo flow in Suggestions UI. Query must always include `.is('deleted_at', null)` filter.
- **In rebuild:** All suggestion queries must filter out soft-deleted rows. Do not change to hard deletes without removing the undo feature.

### 5. Suggestion Status Lifecycle
- **Column:** `movie_suggestions.status` (enum-like: `'pending'` | `'selected'`)
- **Flow:** Suggestions start as `'pending'`. When a Movie Night is created from a suggestion, `markSuggestionSelected()` sets it to `'selected'`. Suggestions queue only shows `status = 'pending'` rows.
- **In rebuild:** The Movie Night creation flow must call `markSuggestionSelected(suggestionId)` when a suggestion is used as the source.

### 6. movie_cast Column — Comma-Separated String
- **Column:** `movies.movie_cast` (text, comma-separated actor names from OMDB)
- **Why it's a constraint:** OMDB returns actors as a comma-separated string. This is stored as-is, not normalized. Client-side parsing: split by `, `, cap at first 4, abbreviate names > 15 chars to `"First L."`.
- **In rebuild:** Either continue the same pattern (simpler) or normalize into a separate `actors` table (better for stats). If normalizing, write a migration from the comma-string format.
- **Recommendation:** Normalize in rebuild — see data-model.md.

### 7. AI Labelling Rule — Discovery Feature
- **Rule:** The Discovery / recommendations feature must NEVER be labelled as "AI" in any user-facing text
- **Label it as:** "Discover Movies" or "Discovery"
- **Why:** Several group members are averse to AI-branded features. This is a social constraint, not a technical one, but violating it harms adoption.
- **In rebuild:** Search all templates for "AI", "artificial intelligence", "machine learning" — remove or replace with neutral language.

### 8. Mobile Viewport Fix — iOS Safe Area
- **Required CSS on all full-height components:**
  ```scss
  height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom);
  ```
- **Required in index.html:**
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  ```
- **Why:** iOS Safari has a bottom bar that overlaps content. `100vh` clips. `100dvh` adjusts dynamically. `env(safe-area-inset-bottom)` pads for the home indicator on notched iPhones.
- **In rebuild:** Apply to every component that fills the screen height. Test on real iOS Safari.

### 9. Date Parsing — Always Use Local Time Constructor
- **Problem:** `new Date('2024-05-15')` is parsed as **UTC midnight** by browsers. In US timezones (UTC-5 to UTC-8), this renders as the **previous day**.
- **Required pattern:**
  ```typescript
  // WRONG
  new Date('2024-05-15')

  // CORRECT
  const [y, m, d] = '2024-05-15'.split('-').map(Number);
  new Date(y, m - 1, d); // Local time constructor
  ```
- **In rebuild:** Create a shared utility `parseLocalDate(dateStr: string): Date` on day one. Never use `new Date(isoDateString)` for YYYY-MM-DD strings.

### 10. OMDB Search — DB-First Strategy
- **Flow:**
  1. Search local `movies` table with `ilike('%title%')`
  2. If fewer than 3 results, supplement with OMDB API call
  3. Dedup by `imdb_id`
- **Why:** OMDB free tier is 1,000 calls/day. The app tries to serve from its own cache first.
- **In rebuild:** Do not call OMDB directly on every keystroke. Respect the DB-first strategy. The 2.5s debounce on search input is intentional and must be preserved.

### 11. OMDB Rate Limit Awareness
- **Limit:** 1,000 calls/day (free tier)
- **Tracking:** `app_settings.omdb_calls_today` is incremented on each OMDB API call
- **Bulk import:** Uses `concatMap` with 200ms delay between rows to avoid burst rate-limiting
- **In rebuild:** Preserve the counter and the delay pattern. Do not parallelize OMDB calls in bulk import.

### 12. Passcode Auth — No Account System
- **Auth model:** Single shared 6-digit passcode for all members. No individual accounts. No session tokens from Supabase Auth.
- **Passcode storage:** SHA-256 hash stored in `app_settings.passcode_hash`. Hash computed in-browser using Web Crypto API.
- **Session flag:** `ff_passcode_verified` in localStorage (string `'true'`). Not a JWT. Not tied to Supabase Auth.
- **In rebuild:** Do not migrate to Supabase Auth unless the app's social model changes. This is a trusted friend group — individual accounts add friction with no benefit.

### 13. Environment Variable Injection — Build-Time Only for Secrets
- **Sensitive variables** (never stored in localStorage):
  - `dtddApiKey` (DoesTheDogDie)
- **Semi-public variables** (may be stored in localStorage as fallback):
  - `supabaseUrl`, `supabaseAnonKey`, `omdbApiKey` — these are stored in localStorage when entered via Admin screen at runtime
- **Production values:** Injected at build time via GitHub Actions secrets → `environment.prod.ts`
- **In rebuild:** Preserve the dual-source pattern: try environment first, fall back to localStorage. Never write DTDD key to localStorage.

---

## Known Gaps (Acknowledged Limitations, Not Blockers)

| Gap | Impact | Recommended Fix in Rebuild |
|-----|--------|---------------------------|
| No passcode recovery path | Admin must manually update DB if passcode is forgotten | Add a "reset passcode" flow in /admin that requires DB access (or a secondary PIN) |
| Client-side stats aggregation | Will not scale past ~500 movie nights | Move StatsService and ProfileService aggregations to Supabase RPC functions |
| movie_cast is a comma-string | Profile actor stats require client-side parsing and truncation | Normalize actors into a separate table in rebuild |
| Discovery feature is a stub | /discover renders a placeholder, no real functionality | Implement Claude API integration via Supabase Edge Function |
| No test coverage on services | Services have no unit tests | Add service-layer tests in rebuild using TestBed + mock Supabase client |
| OMDB call count not enforced | App tracks but does not block when limit is hit | Add soft limit UI warning when omdb_calls_today > 900 |
