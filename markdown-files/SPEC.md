# Film Foodies 🎬🍽️ — Full Project Specification

**Version:** 1.5  
**Date:** April 2026  
**Repository:** https://github.com/jermoe1/film-foodies  
**Admin:** Jerry  
**Status:** Active Development

> **Changes from v1.4:** Profile page header updated to social profile style (avatar ring + name, not cinematic header). Profile page build instructions extracted to `BUILD_PROFILE.md`. Spec converted to Markdown for GitHub.

---

## 1. Tech Stack

| Component | Tool | Cost |
|---|---|---|
| Framework | Angular (single-page application) | Free |
| Routing | Hash-based (`#/history`, `#/suggest` etc.) | Free |
| Code storage | GitHub — github.com/jermoe1/film-foodies | Free |
| Hosting | GitHub Pages via GitHub Actions CI/CD | Free |
| Database | Supabase (Postgres, free tier) | Free |
| Movie data | OMDB API (1,000 calls/day, daily reset) | Free |
| Content warnings | DoesTheDogDie.com API | Free |
| AI features | Claude API (Discovery + Trivia facts) | Usage-based |
| **Total ongoing** | | **~$0** |

- Angular SPA deployed automatically via GitHub Actions on every push to `main`
- README includes a dedicated section explaining the pipeline, monitoring, and troubleshooting
- Hash-based routing (`HashLocationStrategy`) — one-line Angular config, full GitHub Pages compatibility
- All API keys entered via in-app config screen, stored in browser local storage only — never committed to GitHub
- OMDB data cached in `movies` table to protect 1,000/day limit; monthly auto-refresh with 500-call daily threshold

---

## 2. Database Schema (Supabase)

> See `supabase/schema.sql` for the full executable setup script including indexes, triggers, RLS rules, views, and seed data.

Scores stored as `##.#` decimal on 0.0–10.0 scale. Conversion: 1 star = 2.0, 2.5 stars = 5.0, 5 stars = 10.0.

> **Important:** Several column names differ from common intuition to avoid PostgreSQL reserved words. Always use: `movie_cast` (not `cast`), `movie_language` (not `language`), `release_year` (not `year`), `full_name` (not `name`), `review_note` (not `note`).

### movies
`id, title, release_year, imdb_id (unique), imdb_url, poster_url, genre, director, movie_cast, runtime, imdb_rating, country, movie_language, raw_omdb (jsonb), content_warnings (jsonb array), last_omdb_fetch (timestamp), created_at`

- `raw_omdb` stores full OMDB JSON response for re-parsing if format changes
- `country` and `language` populated automatically from OMDB at no extra API cost
- `content_warnings` populated from DoesTheDogDie.com alongside OMDB fetch
- Content warning structure: `{ warning, severity, source, source_url }`
- Monthly auto-refresh via Supabase Edge Function; pauses at 500 calls/day; resumes next day
- Manual admin refresh available in Settings for individual movies

### members
`id, full_name, first_name, avatar_color, display_order, is_admin (boolean), created_at`

- Jerry seeded as admin (`is_admin = true`) in initial SQL setup script

### app_settings
Single-row table: `passcode_hash, rating_scale (fixed: numeric_10), theme, omdb_calls_today, omdb_calls_reset_date, omdb_refresh_in_progress, omdb_refresh_last_movie_id, updated_at`

- Protected against deletion via Supabase Row Level Security (RLS)
- Seeded during initial SQL setup

### movie_suggestions
`id, movie_id (FK → movies), suggested_by (FK → members), suggested_at, status (pending/selected/watched), deleted_at (timestamp, nullable), manual_warnings (text array)`

- Soft delete: `deleted_at` set on deletion; all queries filter `WHERE deleted_at IS NULL`
- 5-second undo toast on deletion; hard purge available later if needed
- `manual_warnings` stores member-added content warnings with `added_by` name

### suggestion_votes
`id, suggestion_id (FK → movie_suggestions), member_id (FK → members), vote (up/down), voted_at`

- Unique constraint on `(suggestion_id, member_id)` — enforced at database level
- Members can change their vote at any time

### movie_nights
`id, movie_id (FK → movies), suggestion_id (FK → movie_suggestions, nullable), host_id (FK → members), date, food_main, food_sides, food_drinks, watch_platform, cut_version, subtitle_option, viewing_environment (text array), photo_url, created_by (FK → members), created_at`

- `food_main / food_sides / food_drinks` replace single `food_description` field
- `watch_platform`: Netflix, Prime Video, Prime Rental, Plex, Paramount+, HBO/Max, Hulu, Disney+, Crunchyroll, Apple TV+, Tubi, Blu-ray, DVD, 4K UHD, Digital Purchase/Rental, Other
- `cut_version`: Standard, Director's Cut, Extended Cut, Theatrical Re-release
- `subtitle_option`: null (English-language), Original with subtitles, Dubbed in English, Original no subtitles
- `viewing_environment`: array of Projector, Large TV

### movie_night_attendees
`id, movie_night_id (FK → movie_nights), member_id (FK → members), attended (boolean, default true), created_at`

- Auto-populated via Postgres trigger on `movie_nights` INSERT — one row per active member
- App only needs to handle unchecking absent members

### ratings
`id, movie_night_id (FK → movie_nights), member_id (FK → members), score (decimal ##.#, 0.0–10.0), review_note (optional), tags (text array), first_watch (boolean, nullable), created_at, updated_at`

- `first_watch`: true = first time member has seen film, false = rewatch, null = not present
- Ratings entered exclusively via the Rate button flow — never during bulk import
- Ratings can be changed at any time — no lock-in

### movie_night_notes
`id, movie_night_id (FK → movie_nights), member_id (FK → members), note_text, is_edited (boolean), created_at, updated_at`

- Forum thread style — any member can post multiple notes per movie night
- Authors can edit their own notes; "edited" indicator shown
- No deletion — notes are permanent to preserve group memory

### fun_facts
`id, movie_id (FK → movies), fact_text, source_url, source_label, created_at`

- Auto-fetched only — sourced from IMDB, fan wikis, Fandom when a movie is first logged
- Read-only for members — no manual fact entry
- Every fact includes a tappable source link

### discovery_history
`id, member_id (FK → members), movie_id (FK → movies), shown_at`

- Rows older than 90 days purged periodically

### member_ignores
`id, member_id (FK → members), movie_id (FK → movies), ignored_at`

- Permanently hides a movie from Discovery for a specific member

### Indexes
All 15 indexes defined in `supabase/schema.sql`. Key indexes:

| Table | Column(s) |
|---|---|
| movies | imdb_id |
| movie_suggestions | status, deleted_at, suggested_by |
| movie_nights | date, host_id |
| movie_night_attendees | movie_night_id, member_id |
| ratings | movie_night_id, member_id |
| fun_facts | movie_id |
| movie_night_notes | movie_night_id |
| discovery_history | member_id |
| member_ignores | member_id |

---

## 3. User Identity & Access

- No individual logins or passwords
- Site-wide 6-character passcode — intended to be a memorable date (e.g. `042019`)
- Passcode hash stored in Supabase `app_settings`; entry cached in browser until cookies/cache cleared
- Wrong passcode: inline "Incorrect passcode — try again" message; no lockout
- Members select first name from dropdown on first use; remembered in browser local storage
- Switching devices requires re-picking name and theme
- "Switch Names" accessible via hamburger menu at any time
- Site-wide error banner: "Having trouble connecting? Contact Jerry." when Supabase is unreachable

### First-Run Setup Wizard (Jerry only, on first visit)

1. **Step 1:** Set the 6-character site passcode
2. **Step 2:** Name yourself (pre-filled "Jerry")
3. **Step 3:** Add remaining members — up to 5 more; "Skip for now" option available
4. **Step 4:** "You're all set! Start by adding your first movie suggestion or importing your history."

---

## 4. Themes

Themes are personal and per-device — stored in browser local storage. Each member picks their own independently.

| Theme | Background | Primary Accent | Vibe |
|---|---|---|---|
| Cinema Mode (default) | `#0D0D0D` | Gold `#C8860A` | Dark cinematic |
| Lobby Mode (light) | `#FDF6EC` | Gold `#C8860A` | Warm cream |
| High Contrast | `#000000` | Yellow `#FFD700` | WCAG AAA accessibility |
| Anti-Glare (outdoor) | `#2A2A2A` | Amber `#B8730A` | Matte, readable in sunlight |
| Colorblind (deuteranopia) | `#0D0D0D` | Blue `#1A4A8B` | Red/green safe |
| Forest Mode | `#0A2A0A` | Moss `#4A8B2A` | Green focus |

**Lobby Mode palette:** cream `#FDF6EC` bg, warm white `#FFFAF4` surfaces, deep burgundy `#4A1A1A` text, warm brown `#8B5A2B` secondary, gold `#C8860A` accent, warm gray `#E8D5B7` borders

Additional fun themes to be added at a later date.

---

## 5. Home Screen

### Layout
- Full bleed, edge-to-edge display
- Film Foodies logo + "Movie & Dinner Club" subtitle overlaid at top via dark gradient fade
- 3 vertical panels filling full screen height
- Rate bar at the bottom — conditionally visible
- Floating hamburger button overlaid on the Rate bar (left or right per handedness setting)

### Panels

| Panel | Label | Accent Color |
|---|---|---|
| 1 | Suggest | Deep Gold |
| 2 | Movie Night | Crimson Red |
| 3 | History | Midnight Blue |

> **TODO:** Review "Movie Night" label on panel 2 with group after launch.

- Dark cinematic base with accent color glow per panel
- Large icon centered + bold label below, vertically centered
- Tapping triggers full-screen expand animation then transitions to that section
- Fallback animation: scale + fade if expand causes performance issues
- No hover states — all animations are tap/touch triggered

### Rate Bar
- Hidden when current user has no unrated movie nights
- Appears when user attended a movie night and has not yet rated it
- Full width, centered "Rate" label with star icon
- If 1 movie remaining: 44×44px square crop from top third of poster bleeds into left side of bar
- Tap animation: poster expands from thumbnail to full-width portrait (~350–400ms); rating screen rises above; fallback: slide-up sheet
- "Not Present" option marks `attended = false`, dismisses rating prompt

### Empty States

All empty states: thematic icon + informational headline + 1–2 sentences + CTA button. Consistent structure, visually distinct per screen.

| Screen | Headline | CTA |
|---|---|---|
| Home | Your movie club starts here | Log your first movie night |
| Queue | No suggestions yet — the floor is open | Suggest a movie |
| History | No nights on the books yet | Log a movie night |
| Stats | Stats appear after your first rated movie night | Go to History |
| My Profile | Your profile builds as you rate movies | Rate a movie |
| Discovery | Your personalized picks appear after rating a few movies | Rate a movie |

### Hamburger Menu

Grouped with a visual divider — frequent above, management below.

| Item | Description |
|---|---|
| 👤 Switch Names | Change which member you are |
| 🧑 My Profile | Personal rating history, favorite genres, top actors |
| ✨ Discover Movies | Personalized picks — decorative ✨ badge, refreshes every Monday 12:00am EST |
| 📋 View Suggestions | Full suggestion queue with Up/Down voting |
| 📊 Stats | Group analytics, charts, and Split the Room |
| — divider — | |
| 📥 Bulk Import | Add historical movie nights in bulk |
| 📤 Export Data | Download full human-readable data export |
| ⚙️ Settings | Theme, handedness, passcode, API keys, member admin |

---

## 6. Suggest a Movie

- User searches by movie title — `movies` table checked first; OMDB API called only if not cached
- OMDB auto-fills: poster, year, genre, director, cast, runtime, IMDB rating, IMDB URL, country, language
- Content warnings auto-fetched from DoesTheDogDie.com alongside OMDB data; displayed with source link
- Manual warnings field: free text for suggester to add their own content concerns
- Warning badge (⚠️) on compact suggestion card; color-coded: yellow mild, orange moderate, red severe
- No limit on suggestions per member
- Only the suggesting member can delete their own suggestion
- Deletion: 5-second undo toast; soft delete (`deleted_at` set)
- Confirmation dialog before deletion

---

## 7. Suggestion Queue (View Suggestions)

- Default sort: Oldest first (first in, first out)
- Sort options: Oldest first, Newest first, Most upvoted, A–Z
- Each card: poster, title, year, genre, director, runtime, IMDB rating, IMDB link, language badge (non-English only), suggested by, Up/Down vote counts, warning badge if applicable

### Up/Down Voting (Ranker-style)
- Each member casts one vote per suggestion: Up or Down
- Members can change vote at any time
- Vote counts displayed (e.g. `+8 / -2`)
- Current member's vote state highlighted on the card
- Large, clearly separated tap targets to prevent mis-taps

### Actions per card
- Vote Up or Down
- Delete — suggester only; requires confirmation; 5-second undo toast
- Select for Movie Night — opens Movie Night screen with movie pre-filled

---

## 8. Movie Night (Log a Night)

- Any member can log a movie night; must select who the host was
- If manually entered movie is not in suggestion queue: prompt to auto-add, then resume logging flow seamlessly
- Confirmation dialog before saving edits to a past movie night

### Form Fields

| Field | Notes |
|---|---|
| Movie | From queue or manual OMDB search (cache first) |
| Host | Dropdown of all members |
| Date | Defaults to today; editable for past or future nights |
| Attendees | 2×3 grid of first name + avatar color initial circle; all pre-checked; uncheck absent members |
| Food — Main Dish | Free text — dedicated food section |
| Food — Sides & Snacks | Free text |
| Food — Drinks | Free text |
| Photo URL | Optional — paste link to externally hosted image |

### Advanced Options (collapsed by default)

| Field | Options |
|---|---|
| Watched Via | Netflix, Prime Video, Prime Rental, Plex, Paramount+, HBO/Max, Hulu, Disney+, Crunchyroll, Apple TV+, Tubi, Blu-ray, DVD, 4K UHD, Digital Purchase/Rental, Other |
| Cut | Standard, Director's Cut, Extended Cut, Theatrical Re-release |
| Subtitles/Dubbing | Shown only for non-English films: Original with subtitles / Dubbed in English / Original no subtitles |
| Viewing Environment | Checkboxes: Projector, Large TV |

**Attendee grid:** 2×3 at ≥390px viewport width; 1×6 pill list below 390px. Postgres trigger auto-populates all attendees — app only handles unchecking.

---

## 9. Ratings

- Accessed exclusively via the Rate button flow — never during bulk import
- Rate bar appears when user has unrated movie nights; tapping opens picker of pending nights

### Rating Flow

1. **Step 1:** "Was this your first time watching [Movie]?" — First watch / Rewatch
2. **Step 2:** Enter score — typable numeric field (`##.#`), with − and + buttons adjusting by 0.1; clamps to 0.0–10.0; auto-formats on blur
3. **Step 3:** Optional review note (free text)
4. **Step 4:** Optional emoji tags — 😂 Hilarious · 😢 Tearjerker · 😱 Disturbing · 🤯 Mind-blowing
5. **"Not Present"** option at any step — marks `attended = false`, dismisses prompt

- Ratings changeable at any time — no lock-in
- Average group rating shown on History cards in `##.#` format

### Rating Scale

- **Active:** Numeric 0.0–10.0, one decimal place
- Star rating UI stubbed in `RatingInputComponent` with `@Input() mode: 'numeric' | 'stars-whole' | 'stars-half'`
- Star modes not exposed in UI — TODO comments mark the stub code
- All scores stored as `##.#` decimal regardless of display mode

### First Watch / Rewatch
- Per member per movie night — each individual's own experience
- History expanded detail shows: "First watch: Jerry, Sarah · Rewatch: Tom, Lisa"
- Stats: average first-watch rating vs rewatch rating

---

## 10. History

- Default sort: Most recent first
- Tap-to-expand cards — compact list by default

### Compact card shows
- Poster thumbnail, title, year, date, host name, average group rating (`##.#`)
- Non-English language badge (e.g. 🌐 Korean) if applicable
- Warning badge (⚠️) if content warnings exist

### Expanded detail shows
- Full poster, all movie metadata, IMDB link
- Country · year · runtime on one line (e.g. "South Korea · 2016 · 118 min")
- Language badge and subtitle option if non-English
- Platform, cut version (if not Standard), viewing environment
- Food: 🍽️ Main · 🍿 Sides & Snacks · 🥂 Drinks
- Photo (rendered from URL if provided)
- First watch breakdown: "First watch: [names] · Rewatch: [names]"
- Each member's rating (`##.#`), note, and emoji tags
- Members marked Not Present shown separately

### Tabs within expanded detail
- **Details** (default) — all of the above
- **Trivia & Facts** — auto-fetched facts with source links; read-only
- **Notes** — forum thread; any member can post and edit their own notes; no deletion

### Filtering
- Search by movie title
- Filter by genre
- Filter by host

---

## 11. Stats Page

- Access via hamburger menu → Stats
- Toggle: Personal view vs Group view
- Chart type chosen intelligently per stat

### Standard Stats

| Dimension | Chart Type |
|---|---|
| Genre | Bar |
| Decade | Bar |
| Director | Bar |
| Lead Actor/Actress | Bar |
| Host | Bar |
| Runtime | Scatter/bar |
| IMDB vs Ours | Scatter |
| Movie Night frequency | Line |
| Rating distribution | Histogram |
| Country of origin | Bar |
| Language | Bar |
| First watch vs Rewatch | Bar |

### Split the Room Section
- **Split the Room** — top 3 most polarizing films (highest rating variance); member ratings shown side by side
- **Perfect Consensus** — top 3 most agreed-upon films (everyone within 1.0 of each other)
- **Group Contrarian** — which member's ratings diverge most from group average
- **Biggest Surprise** — films rated significantly higher than IMDB by your group
- **Hidden Gems vs Overhyped** — where your group consistently agrees or disagrees with mainstream opinion

---

## 12. My Profile

> See `BUILD_PROFILE.md` for full build instructions, component structure, data queries, and visual specifications.

- Full-screen scrollable page, accessed from hamburger menu
- Scoped entirely to the currently active member

### Profile Header (social profile style)
- 80×80px avatar ring — member's `avatar_color` as border, first initial centered in Georgia serif
- Member's `first_name` below in 20px Georgia serif
- "Admin · Member since [Month Year]" or "Member since [Month Year]" subtitle
- Four stat pills: Watched · Avg Score · Suggested · Hosted

### Content Sections (top to bottom)
1. Favorite Genres — top 3 compact cards with "see more"
2. Top Directors — top 3 compact cards with "see more"
3. Top Actors — top 3 compact cards with "see more"
4. My Contrarian Score — single card with delta and label
5. Rating Trend — SVG line chart, avg score per month, last 12 months
6. My Ratings — 3-column poster grid; my score overlaid; "1st"/"re" badge; group avg on tap
7. My Suggestions — list of pending suggestions with vote counts

---

## 13. Trivia & Facts

- Dedicated tab within any movie's expanded detail page
- Also accessible from the active Movie Night screen
- Auto-fetched from IMDB, fan wikis, Fandom when a movie is first logged — stored permanently
- Read-only for all members — no manual fact entry
- Every fact includes a tappable source link
- Labeled "Trivia & Facts" in UI — no mention of AI

---

## 14. Notes (Forum Thread)

- Dedicated tab within any movie's expanded detail page
- Any member can post at any time — before, during, or after the movie night
- Each note: avatar color circle + first name + note text + small timestamp (e.g. "Jerry · Apr 12, 11:47pm")
- Sorted oldest first — thread reads chronologically
- Authors can edit their own notes; "edited" indicator shown
- No deletion — notes are permanent to preserve group memory
- Text input + "Post" button always visible at bottom of tab

---

## 15. Discover Movies

- Access via hamburger menu — intentionally low-key given group's current AI-aversion
- Decorative ✨ badge on menu item — purely visual, not a notification
- Discovery list refreshes every Monday at 12:00am EST via Supabase scheduled Edge Function
- Called "Discover Movies" in UI — no AI branding

### Display
- Scrollable list of 20 movie recommendations
- Each card: poster, title, year, genre, director, cast, runtime, IMDB rating, IMDB link, language badge if non-English
- **Add to Suggestions** — adds directly to group suggestion queue
- **Don't Recommend Again** — permanently hides movie for this user (`member_ignores` table)
- Refresh button at bottom generates a fresh 20-movie list

### Recommendation Logic (priority order)
1. Never show ignored movies — hard filter, per-user
2. Individual taste — genres, directors, actors the user has rated highly
3. Group filter — deprioritize movies the group would likely dislike
4. After 60 unique movies shown, repeats acceptable if pool runs low
5. Rows older than 90 days purged from `discovery_history`

---

## 16. Bulk Import

- Access via hamburger menu → Bulk Import
- Entire import wrapped in Postgres transaction via Supabase RPC — all or nothing
- Detailed per-row error report on failure with fix suggestions
- Ratings never entered during bulk import — Rate button flow only
- If CSV contains rating columns, they are imported; otherwise nights queue in Rate bar

### Method A — Row-by-Row Quick Entry
- Single-row form: Movie Title, Host, Date, Food Main, Food Sides, Food Drinks, Notes, Photo URL
- "Add" button saves that row and reveals a new blank row below; Add button moves down
- Movie title triggers OMDB cache lookup per row
- All rows submitted as a batch on final confirmation

### Method B — CSV Import
- Download CSV template with correct column headers
- Fill offline, upload completed CSV
- OMDB lookups batched with 100–200ms delay between uncached calls; progress bar shown
- Errors flagged per row with fix suggestion before transaction is attempted

### Error Messages

| Problem | How to fix it |
|---|---|
| Date format not recognized | Use MM/DD/YYYY — e.g. 03/04/2023 |
| Movie not found in OMDB | Check spelling or try without the year |
| Host name doesn't match any member | Check Settings → Members for correct spelling |
| Required field missing | Every row must have Movie, Host, and Date |

---

## 17. Data Export

- Access via hamburger menu → Export Data
- Exports as downloadable ZIP containing human-readable CSV files per table
- Foreign keys resolved to human-readable names (e.g. `host_id` → "Jerry")
- `raw_omdb` jsonb column excluded from export
- Tables included: movies, movie_nights, ratings, movie_suggestions, fun_facts, movie_night_notes, members
- Tables excluded: app_settings, member_ignores, discovery_history

---

## 18. Settings & Admin

### Settings (all members)
- Handedness toggle — moves hamburger button left or right on Rate bar
- Theme — personal per-device selection from 6 themes; cached in browser local storage
- Passcode — change the 6-character site-wide passcode
- API Keys — Supabase URL, Supabase publishable key, OMDB key (browser local storage only)
- OMDB status: "OMDB calls today: X / 1,000" and monthly refresh status
- Manual OMDB refresh — admin can trigger fresh fetch for a specific movie

### Admin (member management)
- Add new members
- Rename existing members
- Reorder members (affects dropdowns and display order)

---

## 19. Angular Architecture

### Module Structure

```
AppModule (root)
├── CoreModule — PasscodeService, MemberService, AppSettingsService, ThemeService,
│               SupabaseService (getClientOrNull), NavigationService
├── SharedModule — RatingInputComponent, ToastComponent
│   shared/util/ — DestroyComponent, trackById/trackByMemberId/trackByImdbId,
│                  isNonEnglish, parseYyyyMmDd, scoreColor
│   shared/constants/ — MOVIE_SEARCH_DEBOUNCE_MS, UNDO_TIMEOUT_MS, etc.
│   [planned] — MoviePosterComponent, ProfileStatRowComponent,
│               MovieSearchPickerComponent, PageTopbarComponent
├── HomeModule
├── SuggestionsModule
├── MovieNightsModule
├── RatingsModule
├── HistoryModule
├── StatsModule
├── ProfileModule
├── DiscoveryModule
├── AdminModule
└── BulkImportModule
```

### Key Engineering Decisions

- Supabase client wrapped in Angular services — never called directly from components; returns Observables
- `SupabaseService.getClientOrNull()` is the one safe client accessor — every service calls this, never `getClient()` directly
- `DestroyComponent` base class (`shared/util/destroy.ts`) provides `destroy$` and `ngOnDestroy` — components extend it rather than redeclaring the boilerplate
- `NavigationService` (`shared/services/navigation.service.ts`) provides `goBack()` / `goHome()` — components inject it rather than calling `Router.navigate(['/home'])` directly
- `deleted_at` soft delete filter applied in `SuggestionsService.getAll()` — never in components
- 5-second undo toast uses RxJS `timer()` with `takeUntil()` to defer Supabase UPDATE
- `OmdbService` request queue uses RxJS `concatMap` with `delay()` for bulk import rate limiting
- `RatingInputComponent`: `@Input() mode: 'numeric' | 'stars-whole' | 'stars-half'`; star modes stubbed with TODO comments
- GitHub Actions deploy pipeline: `.github/workflows/deploy.yml` builds on push to `main`, deploys to `gh-pages` branch
- Hash-based routing via `HashLocationStrategy` — prevents GitHub Pages 404 errors

---

## 20. Navigation Structure

| Entry Point | Destination |
|---|---|
| Home → Suggest panel | Suggest a movie (OMDB search) |
| Home → Movie Night panel | Log a movie night |
| Home → History panel | Browse past movie nights (tap to expand) |
| History → tap movie | Expanded detail: Details / Trivia & Facts / Notes tabs |
| Home → Rate bar | Rate pending movies (first watch → score → note → tags) |
| Hamburger → Switch Names | Change active member |
| Hamburger → My Profile | Personal stats and rating history |
| Hamburger → Discover Movies | AI-powered personalized picks |
| Hamburger → View Suggestions | Full suggestion queue with Up/Down voting |
| Hamburger → Stats | Group analytics, charts, Split the Room |
| Hamburger → Bulk Import | Add historical movie nights in bulk |
| Hamburger → Export Data | Download full human-readable data export |
| Hamburger → Settings | Theme, handedness, passcode, API keys, member admin |

---

## 21. Error States

| Scenario | Behavior |
|---|---|
| OMDB API down | "Movie lookup is unavailable right now. You can enter details manually or try again in a moment." — reveals manual entry form |
| Supabase unreachable | Site-wide banner: "Having trouble connecting? Contact Jerry." |
| Bad CSV rows | All-or-nothing transaction fails; per-row error table shown with fix suggestions; "Download error report" exports as CSV |
| Wrong passcode | Inline "Incorrect passcode — try again"; no lockout |

---

## 22. Open Items & TODOs

| # | Item | Priority |
|---|---|---|
| 1 | TODO: Review "Movie Night" label on panel 2 with group after launch | Low |
| 2 | Emoji tag list — confirm final set with group | Low |
| 3 | Present rating scale comparison to group; numeric 0–10 active until group decides | Low |
| 4 | CSV import template — design column headers before bulk import session | Medium |
| 5 | Member names — replace placeholder names before launch (Jerry pre-seeded) | High |
| 6 | Site passcode — agree on 6-character passcode with group before launch | High |
| 7 | Historical data entry — plan bulk import session for 25+ past movie nights | High |
| 8 | API keys — confirm Supabase URL, publishable key, and OMDB key are ready | High |
| 9 | DoesTheDogDie.com API — confirm access and response format before build | High |

---

## Related Files

| File | Purpose |
|---|---|
| `SPEC.md` | This file — full project specification |
| `CONTEXT.md` | Key decisions and reasoning from planning phase |
| `STYLE_GUIDE.md` | Canonical coding patterns and global utilities reference |
| `REFACTOR_BACKLOG.md` | Prioritised tech-debt and cleanup tasks from the April 2026 audit |
| `BUILD_PROFILE.md` | Detailed build instructions for the My Profile page |
| `supabase/schema.sql` | Full database setup script — run once in Supabase SQL Editor |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD pipeline |
| `README.md` | Setup, deployment, and pipeline documentation |

---

*Film Foodies SPEC.md v1.5 — github.com/jermoe1/film-foodies*
