# Film Foodies — Developer Context

This file captures key decisions, reasoning, and nuances from the planning phase that are not fully explicit in the spec document. Read this alongside `SPEC.md` and `supabase/schema.sql` before writing any code.

---

## Project Identity

- **App name:** Film Foodies 🎬🍽️
- **Tagline:** Movie & Dinner Club
- **Repo:** https://github.com/jermoe1/film-foodies
- **Live URL:** https://jermoe1.github.io/film-foodies
- **Admin:** Jerry (seeded in database; is_admin = true)
- **Group size:** 6 members (expandable via admin screen)
- **Purpose:** Private app for a friend group that hosts movie nights with themed food pairings

---

## Tech Stack Decisions & Reasoning

### Angular (not React)
- Switched from React to Angular during planning
- Jerry is learning Angular in his day job — continuity of learning was the deciding factor
- Use Angular's opinionated structure: feature modules, services, reactive forms, Observables
- Never call Supabase directly from components — always go through a service that returns Observables

### GitHub Pages + Hash Routing
- Hosting on GitHub Pages (static only — no server)
- Angular router must use `HashLocationStrategy` — one-line provider change in AppModule
- URLs will look like `/#/history`, `/#/suggest` etc.
- This is intentional and acceptable for a private friend group app
- Do NOT attempt HTML5 push-state routing — it will 404 on GitHub Pages

### GitHub Actions CI/CD
- `.github/workflows/deploy.yml` must be created on day one
- Triggers on every push to `main`
- Builds Angular app with `ng build --base-href "/film-foodies/"`
- Deploys built files to `gh-pages` branch
- README must include a section explaining the pipeline

### Supabase
- Free tier — plenty for a group of 6
- All API keys entered via in-app config screen, stored in browser local storage only
- Keys are NEVER committed to GitHub
- Supabase client wrapped in Angular services — never called directly from components

### OMDB API
- Free tier: 1,000 calls/day, resets daily
- All responses cached in `movies.raw_omdb` (jsonb) + structured columns
- Before any OMDB call, check `movies.last_omdb_fetch` — if populated, skip the API
- Monthly auto-refresh via Supabase Edge Function (1st of month)
- Auto-refresh pauses at 500 calls/day; resumes next day at midnight EST
- Tracks state in `app_settings`: `omdb_calls_today`, `omdb_calls_reset_date`, `omdb_refresh_in_progress`, `omdb_refresh_last_movie_id`
- Manual admin refresh available in Settings for individual movies

### DoesTheDogDie.com
- Used for content/trigger warnings alongside OMDB fetch
- Confirm API access and response format before building the fetch logic
- Warnings stored in `movies.content_warnings` as jsonb array: `{ warning, severity, source, source_url }`

---

## Key Architectural Decisions

### Rating Scale
- **Active scale: Numeric 0.0–10.0, one decimal place (##.# format)**
- Stored as a decimal in `ratings.score`
- Conversion table (for reference if stars are ever activated):
  - 1 star = 2.0, 2 stars = 4.0, 2.5 stars = 5.0, 3 stars = 6.0, 3.5 stars = 7.0, 4 stars = 8.0, 4.5 stars = 9.0, 5 stars = 10.0
- Star rating UI is STUBBED — built as empty placeholder in `RatingInputComponent` but NOT exposed in the UI
- `RatingInputComponent` in SharedModule: `@Input() mode: 'numeric' | 'stars-whole' | 'stars-half'`
- Numeric mode: fully implemented
- Star modes: stub with `// TODO: implement if group switches to star rating` comment
- This component is used in: Rate flow, History expanded detail, My Profile, Stats, Bulk Import CSV mapping

### Soft Deletes (movie_suggestions only)
- `movie_suggestions` has a `deleted_at` (timestamp, nullable) column
- Soft delete pattern: set `deleted_at = now()` instead of DELETE
- ALL queries on `movie_suggestions` MUST include `.is('deleted_at', null)` filter
- This filter belongs in `SuggestionsService.getAll()` as the default — NEVER in components
- 5-second undo toast after deletion: uses RxJS `timer()` with `takeUntil()` to defer the Supabase UPDATE
- If user taps Undo within 5 seconds, the update is cancelled
- All other tables use hard deletes

### Movies Table (merged with OMDB cache)
- No separate `omdb_cache` table — everything lives in `movies`
- `raw_omdb` jsonb column stores full OMDB response verbatim
- Structured columns (title, genre, director etc.) are populated by parsing raw_omdb
- This means if OMDB changes their response format, we can re-parse cached data without new API calls
- `country` and `movie_language` columns populated from OMDB — no extra API cost

### Postgres Trigger — movie_night_attendees
- A Postgres trigger fires on every INSERT into `movie_nights`
- It loops through all active members and inserts one row per member into `movie_night_attendees` with `attended = true`
- The Angular app NEVER manually inserts into `movie_night_attendees` on creation
- The app only handles UNCHECKING members (UPDATE attended = false)
- This makes attendee population atomic at the database level

### Bulk Import Transaction
- Entire bulk import wrapped in a Postgres transaction via Supabase RPC
- All-or-nothing: if any row fails, nothing is committed
- Detailed per-row error report shown on failure with fix suggestions
- OMDB lookups during import use RxJS `concatMap` with 100-200ms delay between uncached calls
- Ratings are NEVER entered during bulk import — they queue in the Rate bar for each member

### Notes vs Trivia & Facts
- These are two separate tabs on every movie's expanded detail page
- **Trivia & Facts:** Auto-fetched from external sources (IMDB, fan wikis, Fandom etc.); read-only; every fact has a source link; stored in `fun_facts` table linked to `movie_id`
- **Notes:** Forum thread; any member can post; authors can edit their own; no deletion; stored in `movie_night_notes` table linked to `movie_night_id`
- Do NOT conflate these two features — they serve completely different purposes

### First Watch / Rewatch
- Stored as `first_watch` boolean on the `ratings` table (nullable — null means Not Present)
- Collected as Step 1 of the rating flow BEFORE the user enters their score
- Per member per movie night — half the group can be first-timers while others rewatch
- Enables Stats: avg first-watch rating vs rewatch rating

---

## User Identity & Access

### No Accounts — Name Picker Only
- No login system, no passwords per user
- Members select their first name from a dropdown
- Selection stored in browser local storage — remembered until cache is cleared
- Switching devices requires re-picking name and theme

### Site-Wide Passcode
- 6-character passcode (intended to be a memorable date e.g. 042019)
- Hash stored in Supabase `app_settings` table (NOT just local storage)
- Cached in browser after first correct entry
- Wrong passcode: inline error message, no lockout
- Passcode change in Settings causes all members to re-enter on next visit

### Themes Are Personal
- Theme selection stored in browser local storage — NOT in Supabase
- Each member picks their own theme independently
- 6 themes at launch: Cinema Mode (default dark), Lobby Mode (light), High Contrast, Anti-Glare, Colorblind, Forest Mode
- Global app_settings has a `theme` field but it's the system default only — personal override always wins

---

## Home Screen Architecture

### Three Panels
- Full bleed, edge-to-edge — no separate header block
- Film Foodies logo overlaid at top via dark gradient fade
- Panels: Suggest (Gold), Movie Night (Crimson Red), History (Midnight Blue)
- TODO comment in code: `// TODO: Review 'Movie Night' label with group after launch`
- Tap animation: full-screen expand attempt first; fallback to scale + fade
- No hover states — all interactions are tap/touch

### Rate Bar
- Conditionally visible — hidden when user has no unrated movie nights
- Full width; floating hamburger button overlaid on right (or left if left-handed mode set)
- If 1 movie remaining: 44x44px square crop from top third of poster bleeds into left side
- Tap animation: poster expands from thumbnail to full-width portrait (~350-400ms); rating screen rises above
- Fallback: slide-up sheet from bottom

### Hamburger Menu
- 8 items, grouped with a visual divider:
  - **Frequent:** Switch Names, My Profile, Discover Movies, View Suggestions, Stats
  - **Management:** Bulk Import, Export Data, Settings
- Discover Movies has a decorative ✨ badge — purely visual, NOT a notification
- Discovery list refreshes every Monday at 12:00am EST via Supabase scheduled Edge Function

---

## Discovery (AI-Powered)

### Important: AI-Aversion Awareness
- Several group members are AI-averse
- Discovery is intentionally buried in the hamburger menu
- NEVER label it as "AI" anywhere in the UI — call it "Discover Movies"
- The ✨ badge is decorative only — does not indicate "AI-generated"
- The goal is for it to feel like a curated feature, not a robot making decisions

### How It Works
- Claude API called when generating recommendations
- Based on individual member's rating history + group's collective ratings
- 20 movies per list; refreshes every Monday 12:00am EST
- Tracks shown movies in `discovery_history` — after 60 unique movies, repeats acceptable
- `member_ignores` permanently hides specific movies per member
- Rows in `discovery_history` older than 90 days are purged periodically

---

## Content Warnings

- Auto-fetched from DoesTheDogDie.com alongside OMDB data
- Stored in `movies.content_warnings` as jsonb array
- Manual warnings by suggester stored in `movie_suggestions.manual_warnings` (text array) with added_by name
- Warning badge (⚠️) on compact suggestion/history cards
- Color-coded by severity: yellow = mild, orange = moderate, red = severe
- Shown prominently on Movie Night screen when selecting a film
- Source link always included for every auto-fetched warning

---

## Language & Country

- `country` and `movie_language` columns on `movies` table — free from OMDB response
- Non-English badge shown on compact History cards and suggestion cards
- Badge shows primary non-English language (e.g. 🌐 Korean); multiple languages show "+1" indicator
- English-only films: no badge shown anywhere
- Country of origin shown in expanded detail only (e.g. "South Korea · 2016 · 118 min")
- Example: Train to Busan → Korean badge on card

---

## Food Fields

- Three separate fields on movie_nights (NOT one combined field):
  - `food_main` — Main Dish
  - `food_sides` — Sides & Snacks  
  - `food_drinks` — Drinks
- Displayed in History expanded detail as:
  - 🍽️ Main · 🍿 Sides & Snacks · 🥂 Drinks

---

## Advanced Options on Movie Night Form

- Collapsed by default — one tap to expand
- Fields: watch_platform, cut_version, subtitle_option (non-English films only), viewing_environment
- Viewing environment: Projector and Large TV checkboxes only (no split viewing — not supported)
- Platform badge shown on History expanded detail
- Cut version shown if not Standard

---

## Attendee Checkboxes

- 2×3 grid at ≥390px viewport width; 1×6 pill list below 390px
- Shows FIRST NAMES only (4–10 characters)
- Each cell: avatar color initial circle + first name
- All pre-checked by default (via Postgres trigger)
- Unchecking sets attended = false in movie_night_attendees

---

## Empty States

All follow same pattern: icon + informational headline + 1-2 sentences + CTA button
Each screen has a distinct accent color and icon — same underlying structure, different personality
See spec Section 5 for full table of empty states per screen

---

## Error States

- **OMDB down:** "Movie lookup is unavailable right now. You can enter details manually or try again in a moment." — reveals manual entry form as fallback
- **Supabase unreachable:** Site-wide banner — "Having trouble connecting? Contact Jerry."
- **Bad CSV rows:** All-or-nothing transaction fails; detailed per-row error table shown with fix suggestions; "Download error report" button exports as CSV

---

## Stats — Split the Room

- Named after the Jackbox Party Pack game the group enjoys
- Shows top 3 most polarizing films by rating variance (standard deviation)
- Each film shows all member ratings side by side
- Also includes: Perfect Consensus, Group Contrarian, Biggest Surprise, Hidden Gems vs Overhyped
- These are pure math queries on existing ratings data — no new database fields needed

---

## Things Intentionally Left Out of v1

- Pre-watch expectation field (deferred to future version)
- World map stat for countries watched (deferred)
- Split viewing across multiple nights (not supported)
- Aspect ratio tracking (too niche)
- Additional fun themes beyond the 6 at launch (to be added later)
- Streaming availability info (IMDB link covers this)

---

## Open Items Before Launch

1. Replace placeholder member names with real names in Settings
2. Agree on 6-character site passcode with group
3. Confirm DoesTheDogDie.com API access and response format
4. Confirm Supabase URL + publishable key + OMDB key are ready
5. Plan bulk import session for 25+ historical movie nights
6. Design CSV template column headers for bulk import
7. Present rating scale comparison to group (artifact available in planning chat)

---

## File Structure (Planned)

```
film-foodies/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD pipeline
├── src/
│   └── app/
│       ├── core/               # CoreModule — singleton services
│       ├── shared/             # SharedModule — reusable components
│       ├── home/               # HomeModule
│       ├── suggestions/        # SuggestionsModule
│       ├── movie-nights/       # MovieNightsModule
│       ├── ratings/            # RatingsModule
│       ├── history/            # HistoryModule
│       ├── stats/              # StatsModule
│       ├── profile/            # ProfileModule
│       ├── discovery/          # DiscoveryModule
│       ├── admin/              # AdminModule
│       └── bulk-import/        # BulkImportModule
├── supabase/
│   └── schema.sql              # Full database setup script
├── SPEC.md                     # Full project specification (or link to .docx)
├── CONTEXT.md                  # This file
└── README.md                   # Setup, deployment, and pipeline docs
```

---

## Browser & Platform Support

### Supported Browsers
| Browser | Platforms |
|---|---|
| Firefox | Android, iOS, Windows, macOS |
| Chrome | Android, iOS, Windows, macOS |
| Safari | iOS, iPadOS, macOS |

All three browsers must be tested on all listed platforms before any feature is considered complete. No browser-specific workarounds should be silently applied — if a fix is needed for one browser it should be documented here.

### Supported Form Factors
| Form Factor | Examples |
|---|---|
| Phone (portrait primary) | Pixel, Samsung Galaxy, iPhone |
| Tablet | iPad, Android tablets |
| Laptop | 13–15" screens, trackpad navigation |
| Desktop | 24"+ screens, mouse navigation |

**Phone is the primary design target.** All layout decisions default to mobile-first. Tablet, laptop, and desktop are enhanced breakpoints — they must work well but they are not the primary use case.

### Responsive Breakpoints

Use these breakpoints consistently across all components:

| Name | Min-width | Targets |
|---|---|---|
| `sm` (phone) | 0px | Default — all mobile phones |
| `md` (tablet) | 768px | iPad, Android tablets |
| `lg` (laptop) | 1024px | Laptops, small desktop |
| `xl` (desktop) | 1280px | Large desktop monitors |

### Browser-Specific Considerations

**Safari on iOS:**
- `100dvh` is supported from iOS 15.4+ — use the `100vh` fallback for older iOS versions
- `env(safe-area-inset-bottom)` is well-supported on iOS and essential for iPhone home indicator bar
- Safari does NOT support some CSS features until later versions — always check caniuse.com before using newer CSS properties
- Web Storage (localStorage) works normally in Safari unless the user has "Prevent Cross-Site Tracking" set to block all storage — acceptable limitation for this app
- Safari on iOS does not show a bottom browser nav bar in the same way Android does, but `env(safe-area-inset-bottom)` is still needed for the iPhone home indicator (typically 34px on modern iPhones)

**Firefox on Android:**
- Bottom browser nav bar overlaps content when `100vh` is used — fixed by `100dvh` + `env(safe-area-inset-bottom)` (see section below)
- Firefox on desktop has no equivalent issue

**Chrome on Android:**
- Same bottom nav bar issue as Firefox Android — same fix applies
- Chrome on iOS uses Safari's WebKit rendering engine under the hood (Apple requirement) so behaves like Safari on iOS

**Safari on macOS / Firefox and Chrome on desktop:**
- No mobile nav bar concerns
- Full viewport is available — `100vh` and `100dvh` behave identically
- Mouse and trackpad navigation — ensure all interactive elements have visible focus states (`:focus-visible` CSS) for keyboard/trackpad users
- The app should be usable at any desktop window size, not just full-screen

### Desktop & Tablet Layout Adjustments

The app is built mobile-first but should adapt gracefully at larger sizes:

- **Home screen panels:** On tablet (≥768px), consider allowing the 3 panels to be wider with more padding. On desktop (≥1024px), constrain the app to a max-width of ~480px centered on screen — the app should not stretch to fill a 27" monitor awkwardly.
- **Hamburger menu:** On desktop, the hamburger drawer can slide in from the right as a sidebar rather than sliding up from the bottom
- **Poster grid (My Profile):** 3 columns on phone, 4–5 columns on tablet, stays 3 within the constrained max-width on desktop
- **Forms (Movie Night, Suggest, Bulk Import):** Single column on phone, can use 2-column layout on tablet and desktop for field groupings
- **Max-width container:** Wrap the entire app in a `max-width: 480px; margin: 0 auto;` container on screens wider than 768px so it doesn't look like a stretched phone app on desktop

### Focus & Accessibility

On laptop and desktop, users navigate with keyboard and trackpad. Ensure:
- All interactive elements (buttons, links, inputs) have visible `:focus-visible` outlines
- Focus outline color: gold `#d4a03a` at 2px solid, offset 2px — visible on dark backgrounds
- Tab order follows visual reading order (top to bottom, left to right)
- No focus traps except intentional modal dialogs

---

## Mobile Browser Safe Area — Critical CSS Fix

**Problem:** On Firefox and Chrome for Android, the browser's bottom navigation bar sits on top of web content. The CSS `100vh` unit does not account for this bar — it measures the full viewport height including the area hidden behind the browser chrome. This causes the Rate bar on the home screen to be partially or fully obscured without the user scrolling to dismiss the browser nav bar first.

**This must be applied from day one — not retrofitted later.** Any screen with a sticky bottom element is affected.

### Required fix in `src/index.html`

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

The `viewport-fit=cover` attribute is required to opt in to the safe area inset system. Without it, `env(safe-area-inset-bottom)` returns `0` on iOS and some Android browsers.

### Required fix in every full-screen component

```scss
.screen {
  height: 100vh;           /* Fallback for older browsers */
  height: 100dvh;          /* Dynamic viewport height — adjusts when browser UI appears/disappears */
  padding-bottom: env(safe-area-inset-bottom, 0px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
```

### Required fix for any sticky bottom element (Rate bar, submit buttons, drawers)

```scss
.rate-bar {
  flex-shrink: 0;
  margin-bottom: env(safe-area-inset-bottom, 0px);
}
```

### Why each piece matters

- **`100dvh`** — Dynamic viewport height. Recalculates when the browser nav bar appears or disappears, so the screen always fits the visible area. Supported in Firefox Android 110+, Chrome Android 108+. The `100vh` fallback handles older browsers.
- **`env(safe-area-inset-bottom)`** — CSS variable that iOS and Android expose representing the height of the system UI at the bottom (home indicator bar, gesture navigation bar, browser nav bar). Defaults to `0px` if not applicable.
- **`viewport-fit=cover`** — Required meta tag to activate the safe area inset system in the browser.

### Scope — apply this pattern to

- `home.component.scss` — the `.screen` container and `.rate-bar`
- Any full-screen route component that uses `height: 100vh`
- The hamburger menu drawer bottom padding
- Any bottom sheet or modal that has a fixed/sticky bottom action bar
- Form pages (Movie Night, Suggest, Bulk Import) with a sticky submit button at the bottom

### Tested Scenarios

| Scenario | Status | Notes |
|---|---|---|
| Firefox Android — Rate bar hidden by browser nav | Fixed | `100dvh` + `env(safe-area-inset-bottom)` resolves it |
| Chrome Android — Rate bar hidden by browser nav | Fixed | Same fix applies |
| Safari iOS — home indicator bar overlaps bottom | Fixed | `env(safe-area-inset-bottom)` handles iPhone home indicator (34px on modern iPhones) |
| Safari macOS — no bottom UI overlap | No issue | `100vh` and `100dvh` behave identically on desktop |
| Firefox/Chrome desktop — no bottom UI overlap | No issue | No fix needed on desktop browsers |

---

*Film Foodies CONTEXT.md — keep this file updated as new decisions are made during development.*
