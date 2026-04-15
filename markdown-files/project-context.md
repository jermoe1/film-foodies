# Project Context

Film Foodies is a private Angular 18 app (NgModule architecture) for a friend group movie night club. Deployed to GitHub Pages via GitHub Actions.

**Live URL:** https://jermoe1.github.io/film-foodies  
**Repo:** https://github.com/jermoe1/film-foodies

---

## Key Architecture Constraints

- **HashLocationStrategy required** — GitHub Pages cannot serve HTML5 push-state routes. All URLs are `/#/route`.
- **Supabase keys in local storage only** — never committed to source. Users enter them via the in-app Settings screen.
- **DB column is `movie_cast`** (not `cast`) — renamed to avoid PostgreSQL reserved word conflict.
- **`movie_suggestions` uses soft deletes** — `deleted_at` column. Every query must include `.is('deleted_at', null)`.
- **Postgres trigger auto-populates `movie_night_attendees`** on INSERT — the Angular app never inserts into that table at creation time.
- **Discovery feature uses Claude API** but must never be labelled "AI" in the UI (group has AI-averse members). Call it "Discover Movies".
- **Rating scale:** numeric 0.0–10.0. Star modes are stubbed in `RatingInputComponent` but not exposed in the UI.

---

## Deploy Pipeline

Push to `main` → GitHub Actions builds with `--base-href "/film-foodies/"` → deploys `dist/film-foodies/browser/` to `gh-pages` branch via `peaceiris/actions-gh-pages@v4`.

API keys (OMDB, DoesTheDogDie, Supabase URL/anon) are stored as GitHub repository secrets and injected into `environment.prod.ts` at build time by the workflow.
