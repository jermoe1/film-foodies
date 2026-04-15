# Film Foodies

**Movie & Dinner Club** — a private Angular app for a friend group that hosts movie nights with themed food pairings.

Live: [https://jermoe1.github.io/film-foodies](https://jermoe1.github.io/film-foodies)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 18, SCSS |
| Backend / DB | Supabase (PostgreSQL) |
| Movie data | OMDB API (cached in DB) |
| Content warnings | DoesTheDogDie.com API |
| AI recommendations | Claude API (via Supabase Edge Function) |
| Hosting | GitHub Pages (static) |
| CI/CD | GitHub Actions |

---

## CI/CD Pipeline

Every push to `main` triggers the deploy workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

**Steps:**

1. **Checkout** — checks out the repo
2. **Node.js 20** — sets up Node with npm caching
3. **`npm ci`** — installs exact dependencies from `package-lock.json`
4. **`ng build --base-href "/film-foodies/" --configuration production`** — compiles the Angular app for GitHub Pages
   - `--base-href` sets the asset root to match the repo's GitHub Pages path
   - HashLocationStrategy means all routes render as `/#/route` — no 404s on static hosting
5. **Deploy** — pushes `dist/film-foodies/browser/` to the `gh-pages` branch using [peaceiris/actions-gh-pages](https://github.com/peaceiris/actions-gh-pages)
   - `.nojekyll` is added automatically so GitHub Pages serves Angular's files without Jekyll processing

The `gh-pages` branch is managed entirely by the workflow — never push to it manually.

---

## Local Development

```bash
npm install
npm start        # ng serve — http://localhost:4200
npm run build    # production build
npm test         # unit tests (Karma/Jasmine)
```

---

## First-Time Setup

The app requires Supabase credentials entered **in-app** (never committed to the repo):

1. Go to [supabase.com](https://supabase.com) → your project → **Settings > API**
2. Copy **Project URL** and **anon/public key**
3. Open the app → Settings → enter the URL and key
4. Run the SQL in `supabase/schema.sql` once in the Supabase SQL Editor to initialize the database

API keys are stored in browser local storage only. They are never stored in source control.

---

## Project Structure

```
film-foodies/
├── .github/workflows/deploy.yml   # GitHub Actions CI/CD pipeline
├── public/                        # Static assets (served at root)
├── src/
│   ├── environments/              # environment.ts / environment.prod.ts
│   └── app/
│       ├── core/                  # CoreModule — singleton services
│       │   └── services/
│       │       ├── supabase.service.ts
│       │       ├── auth.service.ts
│       │       └── member.service.ts
│       ├── shared/                # SharedModule — reusable components
│       │   └── components/
│       │       └── rating-input/  # RatingInputComponent (numeric active, stars stubbed)
│       ├── home/                  # Three-panel landing screen
│       ├── suggestions/           # Movie suggestion list + OMDB search
│       ├── movie-nights/          # Create / edit movie night
│       ├── ratings/               # Rate flow (step 1: first watch?, step 2: score)
│       ├── history/               # Past movie nights + expanded detail
│       ├── stats/                 # Group stats + "Split the Room"
│       ├── profile/               # My Profile (personal ratings + history)
│       ├── discovery/             # Discover Movies (AI-powered, not labelled as AI)
│       ├── admin/                 # Settings + admin tools
│       └── bulk-import/           # CSV bulk import for historical movie nights
└── supabase/
    └── schema.sql                 # Full database setup script (v1.4)
```

---

## Key Design Decisions

- **HashLocationStrategy** — required for GitHub Pages; URLs look like `/#/history`
- **No user accounts** — members pick their first name from a dropdown; stored in local storage
- **Supabase keys in local storage only** — never in source control
- **Soft deletes** on `movie_suggestions` only — all queries must filter `deleted_at IS NULL`
- **`movie_cast` column** — renamed from `cast` to avoid PostgreSQL reserved word conflict
- **Postgres trigger** auto-populates `movie_night_attendees` on every INSERT to `movie_nights`

---

## Build Progress

### ✅ Done
| Module | Route | Notes |
|---|---|---|
| HomeModule | `/home` | Three-panel layout, rate bar, hamburger menu |
| ProfileModule | `/profile` | Header, genre/director/actor rows, contrarian score, trend chart, poster grid, suggestions list |
| SuggestionsModule | `/suggest` · `/suggest/new` | Queue with sort + voting + undo delete; OMDB search + suggest form; OmdbService |
| SelectMemberModule | `/select-member` | Name picker; restores from local storage on startup; redirects to here if no member saved |
| AdminModule | `/admin` | Connection, appearance (6 themes), passcode (SHA-256), members CRUD + reorder, app info |
| MovieNightsModule | `/movie-night` | OMDB search, ?suggestion= pre-fill, host picker, date, attendee 2×3 grid, food fields, advanced options |
| RatingsModule | `/rate` | 3-step flow: first-watch flag → numeric score → review note + tag chips; dynamic rate bar on home |

| HistoryModule | `/history` | Tap-to-expand cards, 3-tab detail (Details / Trivia / Notes) |
| StatsModule | `/stats` | Group stats: Split the Room, Contrarian, Surprise/Overhyped, genre chart, member score bars |
| BulkImportModule | `/bulk-import` | CSV drag-drop/paste, OMDB enrichment progress, Supabase RPC transaction, error report download |

### 🔲 Remaining Modules (long-term)
| Module | Route | Key complexity |
|---|---|---|
| DiscoveryModule | `/discover` | Claude API integration, member_ignores, weekly refresh |
