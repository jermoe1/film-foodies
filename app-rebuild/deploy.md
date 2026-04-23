# Deploy

> **Persona Discussion**
>
> **Dev:** The hosting setup is deliberate and worth understanding before touching it. GitHub Pages serves static files only — there's no server, no redirects, no 404.html trick needed. The HashLocationStrategy handles this entirely because the server only ever sees the root URL; Angular's router handles the `/#/route` part entirely client-side. If anyone changes to `PathLocationStrategy` thinking it's "cleaner", direct URL access and page refreshes will break.
>
> **Dev:** The CI/CD pipeline is a single GitHub Actions workflow: push to `main` → build with prod config → deploy to `gh-pages` branch. The `--base-href "/film-foodies/"` flag is critical — without it, the app loads assets relative to the root and everything 404s on GitHub Pages (which serves under `/<repo-name>/`).
>
> **PO:** The environment variable injection is the most operationally sensitive part. The Supabase URL, anon key, OMDB key, and DTDD key are all injected at build time from GitHub repository secrets. If a secret is missing from the repo, the build succeeds but the app silently has empty credentials. New deployments or repo forks need those secrets re-configured manually.
>
> **Dev:** Worth documenting the dual-credential pattern: in production, credentials come from the build-injected environment file. In development (and as a fallback), credentials can be entered through the admin UI and stored in localStorage. This is why new users of a production build can still configure Supabase themselves — the runtime fallback exists.
>
> **QA:** One gap I'd flag: there's no deployment verification step in the workflow. After `gh-pages` is updated, there's no automated smoke test. A bad build can be silently deployed. In the rebuild, consider adding a `curl` check against the deployed URL or a post-deploy Playwright test.

---

## Hosting

| Property | Value |
|----------|-------|
| Platform | GitHub Pages |
| Repository | `film-foodies` (GitHub) |
| Served branch | `gh-pages` |
| Base URL | `https://<username>.github.io/film-foodies/` |
| Routing | HashLocationStrategy — URLs are `/#/route`, server only sees `/` |
| 404 handling | Not needed — hash routing prevents server 404s entirely |

---

## Build Configuration

### Angular CLI build command (production)
```bash
ng build --base-href "/film-foodies/" --configuration production
```

**Flags explained:**
- `--base-href "/film-foodies/"` — Required for GitHub Pages. Sets the `<base href>` in `index.html` so Angular knows asset paths are relative to `/film-foodies/`, not `/`.
- `--configuration production` — Uses `environment.prod.ts`, enables tree-shaking, minification, and budget checks.

### Output directory
```
dist/film-foodies/
```
The entire contents of this directory are deployed to the `gh-pages` branch.

### Budget limits (`angular.json`)
| Type | Warning | Error |
|------|---------|-------|
| Initial bundle | 500 kB | 1 MB |
| Component styles | 8 kB | 16 kB |

---

## Environment Files

### `src/environments/environment.ts` (development)
```typescript
export const environment = {
  production: false,
  supabaseUrl: '',         // empty — user enters in admin screen at runtime
  supabaseAnonKey: '',     // empty — user enters in admin screen at runtime
  omdbApiKey: '',          // empty — user enters via localStorage fallback
  dtddApiKey: '',          // empty — DoesTheDogDie (never stored in localStorage)
};
```

### `src/environments/environment.prod.ts` (production)
```typescript
export const environment = {
  production: true,
  supabaseUrl: '${SUPABASE_URL}',           // injected by GitHub Actions
  supabaseAnonKey: '${SUPABASE_ANON_KEY}',  // injected by GitHub Actions
  omdbApiKey: '${OMDB_API_KEY}',            // injected by GitHub Actions
  dtddApiKey: '${DTDD_API_KEY}',            // injected by GitHub Actions
};
```

**How injection works:** The GitHub Actions workflow uses `sed` or `envsubst` to replace `${VAR_NAME}` placeholders with secrets before running `ng build`, or alternatively uses an Angular file replacement strategy that writes the environment file from secrets.

---

## GitHub Actions Workflow

File: `.github/workflows/deploy.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Inject environment variables
        run: |
          sed -i "s|\${SUPABASE_URL}|${{ secrets.SUPABASE_URL }}|g" src/environments/environment.prod.ts
          sed -i "s|\${SUPABASE_ANON_KEY}|${{ secrets.SUPABASE_ANON_KEY }}|g" src/environments/environment.prod.ts
          sed -i "s|\${OMDB_API_KEY}|${{ secrets.OMDB_API_KEY }}|g" src/environments/environment.prod.ts
          sed -i "s|\${DTDD_API_KEY}|${{ secrets.DTDD_API_KEY }}|g" src/environments/environment.prod.ts

      - name: Build
        run: npx ng build --base-href "/film-foodies/" --configuration production

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist/film-foodies
```

---

## GitHub Repository Secrets

These must be configured in **Settings → Secrets and variables → Actions** on the GitHub repository. If any are missing, the build still succeeds but that feature will not work in production.

| Secret Name | Description | Required |
|-------------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xyz.supabase.co`) | **Yes** |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (safe to expose; controlled by RLS) | **Yes** |
| `OMDB_API_KEY` | OMDB free-tier API key (1,000 calls/day) | Recommended |
| `DTDD_API_KEY` | DoesTheDogDie API key (content warnings) | Optional |
| `GITHUB_TOKEN` | Auto-provided by GitHub Actions — do not create manually | Auto |

---

## Local Development

```bash
# Install dependencies
npm install

# Start dev server
ng serve

# App available at:
http://localhost:4200/

# Note: HashRouter still active in dev; URLs are /#/route
# Supabase and OMDB credentials must be entered in the /admin screen
# (environment.ts has empty strings; localStorage fallback is used)
```

### First-time local setup
1. `npm install`
2. `ng serve`
3. Navigate to `http://localhost:4200/#/admin`
4. Enter Supabase URL and anon key → Save & Connect
5. Optionally enter OMDB API key
6. Navigate to `/#/select-member` to use the app

---

## Supabase Configuration

Supabase is not self-hosted — the app connects to an existing Supabase project. The database schema must be initialized before first use.

### Schema initialization
1. Open Supabase Dashboard → SQL Editor
2. Run `supabase/schema.sql` (full schema including tables, triggers, RLS policies, and RPC functions)
3. Verify all tables exist: members, movies, movie_nights, movie_night_attendees, ratings, movie_suggestions, suggestion_votes, movie_night_notes, fun_facts, app_settings

### Required Postgres triggers
Both must exist (see data-model.md for SQL):
- `auto_populate_attendees` — fires after INSERT on movie_nights
- `mark_note_edited` — fires after UPDATE on movie_night_notes

### Required RPC functions
- `bulk_import_movie_nights(rows jsonb)` — must be granted execute permission to the anon role (or authenticated role if using Supabase Auth in the future)

### Row Level Security
The app uses the `anon` key. RLS policies must allow:
- SELECT on all tables (all members can read all data)
- INSERT/UPDATE/DELETE on all tables (no individual user auth — the passcode is app-level only)

In a security-conscious rebuild, consider narrowing RLS so that ratings and notes can only be modified by the "owner" (would require Supabase Auth integration — a significant scope change).

---

## Deployment Checklist (New Deployment or Rebuild)

### GitHub repository setup
- [ ] Repository created (or forked)
- [ ] GitHub Pages enabled (Settings → Pages → Deploy from branch: `gh-pages`)
- [ ] All 4 secrets configured in repository settings (SUPABASE_URL, SUPABASE_ANON_KEY, OMDB_API_KEY, DTDD_API_KEY)

### Supabase setup
- [ ] Supabase project created
- [ ] Schema applied (schema.sql run in SQL editor)
- [ ] Both triggers verified (auto_populate_attendees, mark_note_edited)
- [ ] RPC function verified (bulk_import_movie_nights)
- [ ] At least one row in app_settings table
- [ ] At least one member in members table

### Build verification
- [ ] Push to `main` triggers the GitHub Actions workflow
- [ ] Workflow completes without errors
- [ ] App loads at `https://<username>.github.io/film-foodies/`
- [ ] Navigate to `/#/admin`, verify Supabase config is pre-filled from build-injected env vars
- [ ] Navigate to `/#/select-member`, verify members load
- [ ] Log a test movie night; verify it appears in history

---

## Known Deployment Gotchas

| Issue | Cause | Fix |
|-------|-------|-----|
| All routes return blank page after refresh | Missing `--base-href` flag or PathLocationStrategy used | Ensure `--base-href "/film-foodies/"` and HashLocationStrategy |
| Assets (CSS/JS) 404 after deploy | Incorrect base href | Verify `<base href="/film-foodies/">` in built `index.html` |
| App loads but Supabase fails | Secrets not configured or inject step failed | Check Actions log for sed/envsubst step; verify secrets exist |
| OMDB search doesn't work | OMDB key missing or over rate limit | Check `app_settings.omdb_calls_today`; verify `OMDB_API_KEY` secret |
| Content warnings not shown | DTDD key missing | Verify `DTDD_API_KEY` secret; DTDD key is never stored in localStorage |
| Members list is empty on first load | No members in DB | Add at least one member via `/admin` → Members section |
