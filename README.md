# Film Foodies

**Movie & Dinner Club** — a private web app for a friend group that hosts regular movie nights with themed food pairings.

Live: [https://jermoe1.github.io/film-foodies](https://jermoe1.github.io/film-foodies)
Repository: [https://github.com/jermoe1/film-foodies](https://github.com/jermoe1/film-foodies)

---

## What Is Film Foodies?

Film Foodies is a club app built for a small, private group of friends who gather regularly to watch a movie together and cook a themed meal to match. Think of it as a private social network for a movie night club — one that also happens to track what you ate.

The app handles everything the group needs:

- **Suggest movies** — members can search for and queue up films they want to watch, with automatic poster art, cast/crew info, and IMDB ratings pulled in from the web. Content warnings (violence, animal harm, etc.) are also fetched automatically so the group knows what they're getting into.
- **Vote on what to watch** — the suggestion queue supports up/down voting so the group can surface the most popular picks.
- **Log movie nights** — when a night happens, the host records who attended, what food was served (main, sides, drinks), and which platform it was watched on.
- **Rate and review** — after each night, members rate the film on a 0–10 scale, leave a short review note, and tag the experience. The app tracks whether it was a first-time watch or a rewatch.
- **Browse history** — a scrollable archive of every past movie night with expandable detail cards showing ratings, food notes, fun facts, and group discussion notes.
- **Group stats** — charts and breakdowns: average scores by member, "Split the Room" (films with the biggest score gap), contrarian scores, surprise hits, and overhyped films.
- **Personal profile** — each member has a profile showing their rating history, favorite genres, top directors/actors, and a contrarian score.
- **Discover movies** — personalized film recommendations based on the group's collective taste and viewing history.

### Who uses it?

Film Foodies is a closed app — it requires a site-wide passcode to access. There are no individual user accounts; members simply pick their name from a list on first visit. It's designed for a single trusted group of friends, not the public.

---

## Features at a Glance

| Feature | Description |
|---|---|
| Movie suggestions | Search OMDB, auto-fill movie details, queue for group voting |
| Suggestion voting | Up/Down votes per member; sortable queue |
| Content warnings | Auto-fetched from DoesTheDogDie.com; manual warnings too |
| Movie night log | Date, host, attendees, food (main/sides/drinks), platform, cut version |
| Ratings | 0–10 score, review note, tags, first-watch flag |
| Group discussion | Forum-style notes per movie night |
| Fun facts | Auto-fetched trivia for each film |
| History | Archive of all past nights with expandable detail |
| Group stats | Score distributions, contrarian/surprise metrics, genre charts |
| Personal profile | Per-member rating history, favorite genres/directors/actors |
| Discover movies | Personalized recommendations based on group history |
| Bulk import | CSV import for historical movie nights |
| Themes | 6 visual themes (dark, light, high-contrast, colorblind, outdoor, forest) |
| Passcode access | Site-wide 6-character passcode; no individual logins |

---

## Developer Section

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Angular 18 (NgModule architecture), SCSS |
| Backend / DB | Supabase (PostgreSQL, free tier) |
| Movie data | OMDB API (cached in DB; 1,000 calls/day limit) |
| Content warnings | DoesTheDogDie.com API |
| AI recommendations | Claude API (via Supabase Edge Function) |
| Hosting | GitHub Pages (static) |
| CI/CD | GitHub Actions |

### Local Development

```bash
npm install
npm start        # ng serve — http://localhost:4200
npm run build    # production build
npm test         # unit tests (Karma/Jasmine)
```

### First-Time Setup

The app requires Supabase credentials entered **in-app** (never committed to the repo):

1. Go to [supabase.com](https://supabase.com) → your project → **Settings > API**
2. Copy **Project URL** and **anon/public key**
3. Open the app → Settings → enter the URL and key
4. Run the SQL in `supabase/schema.sql` once in the Supabase SQL Editor to initialize the database

OMDB and DoesTheDogDie API keys are stored as GitHub repository secrets and injected into the build at deploy time. For local development, add them to `src/environments/environment.ts`.

### CI/CD Pipeline

Every push to `main` triggers the deploy workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

1. **Checkout** — checks out the repo
2. **Node.js 20** — sets up Node with npm caching
3. **`npm ci`** — installs exact dependencies from `package-lock.json`
4. **`ng build --base-href "/film-foodies/" --configuration production`** — compiles the Angular app for GitHub Pages
   - `--base-href` sets the asset root to match the repo's GitHub Pages path
   - HashLocationStrategy means all routes render as `/#/route` — no 404s on static hosting
5. **Deploy** — pushes `dist/film-foodies/browser/` to the `gh-pages` branch using [peaceiris/actions-gh-pages](https://github.com/peaceiris/actions-gh-pages)
   - `.nojekyll` is added automatically so GitHub Pages serves Angular's files without Jekyll processing

The `gh-pages` branch is managed entirely by the workflow — never push to it manually.

### Project Structure

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
│       ├── home/                  # Three-panel landing screen
│       ├── suggestions/           # Movie suggestion list + OMDB search
│       ├── movie-nights/          # Create / edit movie night
│       ├── ratings/               # Rate flow (first-watch flag, score, review note)
│       ├── history/               # Past movie nights + expanded detail
│       ├── stats/                 # Group stats + "Split the Room"
│       ├── profile/               # My Profile (personal ratings + history)
│       ├── discovery/             # Discover Movies (AI-powered recommendations)
│       ├── admin/                 # Settings + admin tools
│       └── bulk-import/           # CSV bulk import for historical movie nights
└── supabase/
    └── schema.sql                 # Full database setup script
```

### Database Schema

The full schema is in `supabase/schema.sql`. Key tables:

| Table | Purpose |
|---|---|
| `movies` | Cached OMDB data — title, year, poster, genre, director, cast, ratings |
| `members` | Club members — name, avatar color, admin flag |
| `movie_suggestions` | Suggestion queue; soft-deleted (never hard-deleted) |
| `suggestion_votes` | Per-member up/down votes on suggestions |
| `movie_nights` | Each logged movie night — host, date, food, platform |
| `movie_night_attendees` | Who attended each night (auto-populated by Postgres trigger) |
| `ratings` | Per-member scores, notes, tags, first-watch flag |
| `movie_night_notes` | Forum-style discussion notes per movie night |
| `fun_facts` | Auto-fetched trivia facts per film |
| `discovery_history` | Tracks which recommendations each member has seen |
| `member_ignores` | Permanently hides a film from a member's Discovery feed |
| `app_settings` | Single-row config: passcode hash, theme, OMDB rate-limit counters |

Scores are stored as `##.#` decimals on a 0.0–10.0 scale.

### Key Design Decisions

- **HashLocationStrategy** — required for GitHub Pages; URLs look like `/#/history`
- **No user accounts** — members pick their first name from a dropdown; stored in local storage
- **API keys in local storage / GitHub Secrets only** — never in source control
- **Soft deletes on `movie_suggestions`** — `deleted_at` column; all queries must filter `deleted_at IS NULL`
- **`movie_cast` column** — renamed from `cast` to avoid PostgreSQL reserved word conflict; same for `movie_language`, `release_year`, `full_name`, `review_note`
- **Postgres trigger auto-populates `movie_night_attendees`** on every INSERT to `movie_nights` — Angular never writes to that table directly
- **OMDB data is cached** in the `movies` table to protect the 1,000 calls/day limit; monthly auto-refresh pauses at 500 calls/day and resumes the next day
- **Discovery / AI features** are never labelled as "AI" in the UI — the group has AI-averse members; the feature is called "Discover Movies"

### Adding a New Theme

The app ships with six themes defined in `src/styles.scss` via CSS custom property blocks scoped to `[data-theme="<name>"]` attributes. To design a new theme, use the following prompt with an AI assistant:

> **New theme prompt:**
>
> "I'm adding a new visual theme to a Film Foodies Angular app. The app uses CSS custom properties scoped to a `[data-theme]` attribute. The existing tokens are: `--ff-bg`, `--ff-bg-surface`, `--ff-bg-card`, `--ff-border`, `--ff-text`, `--ff-text-2`, `--ff-text-3`, `--ff-text-4`, `--ff-text-5`, `--ff-gold`, `--ff-gold-hover`, `--ff-red`, `--ff-green`, `--ff-shadow`, `--ff-overlay`. Current themes for reference: dark (default), light, high-contrast, colorblind, outdoor, forest. Design a new theme called `[THEME NAME]` with the aesthetic `[DESCRIBE MOOD/PALETTE]`. Return a complete `[data-theme="[THEME NAME]"] { ... }` CSS block with values for every token listed above, and a short rationale for each color choice."
