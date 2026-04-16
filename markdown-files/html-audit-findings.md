# HTML Template Audit Findings

> Audit performed 2026-04-15. Covers all files under `src/app/**/*.html`.

---

## 1. Dead Code

| Finding | File | Action |
|---------|------|--------|
| `*ngSwitchCase="'stars-whole'"` and `*ngSwitchCase="'stars-half'"` both render stub `<span>` elements with TODO comments; no call site passes these modes | `shared/components/rating-input/rating-input.component.html:24–36` | Remove both `ng-container` blocks, or keep as a comment-only note if modes are planned |
| `<button class="sort-btn" disabled>sort</button>` — hardcoded `disabled`, comment says "bottom sheet not yet implemented" | `profile/profile-poster-grid.component.html:4` | Remove button until bottom sheet is implemented |
| Entire component is `<div class="page-placeholder">Coming soon.</div>` — no routable content, no bindings | `discovery/discovery.component.html:1–5` | Track as a known stub; remove from navigation or add a feature-flag guard |

---

## 2. Duplication Hotspots

### 2.1 Profile stat-row component templates — 3 files

All three row components are structurally identical: same three-state skeleton/empty/cards structure, same `card__rank`, `card__name`, `card__meta` markup, same `items` / `isLoading` binding names. Only the header label and empty-state copy differ.

**Files:**
- `profile/profile-genre-row.component.html:1–23`
- `profile/profile-director-row.component.html:1–23`
- `profile/profile-actor-row.component.html:1–23`

**Recommendation:** Extract a single `<app-profile-stat-row>` component with inputs `label: string`, `emptyText: string`, `items: StatRowItem[]`, `isLoading: boolean`. All three host components pass those inputs; the template lives once. The `StatRowItem` interface already exists in spirit — make it explicit.

---

### 2.2 Movie search UX (search input → results list → selected detail card) — 2 files

`movie-nights.component.html` and `suggest-new.component.html` share the same four-section movie-search flow: spinner-overlay search input, `trackByImdbId` results list with poster/placeholder/info/chevron, "No matches found" hint, and a selected-detail card showing year/genre/director/IMDB rating/runtime. Differences are only BEM block prefixes (`mn__` vs `suggest-new__`) and back-button color.

**Files:**
- `movie-nights/movie-nights.component.html:18–96`
- `suggestions/suggest-new.component.html:15–93`

**Recommendation:** Extract `<app-movie-search-picker>` with outputs `movieSelected: EventEmitter<MovieResult>` and `cleared: EventEmitter<void>`, and input `selectedMovie: MovieResult | null`. Host pages keep only their own form sections (food/date/attendees vs. warnings/submit). This is the highest-value template extraction in the repo.

---

### 2.3 Poster image + placeholder pattern — 8+ files

Every file that displays a movie poster repeats the same two-element conditional:

```html
<img *ngIf="m.posterUrl" [src]="m.posterUrl" [alt]="m.title" class="[block]__poster" />
<div *ngIf="!m.posterUrl" class="[block]__poster [block]__poster--placeholder"></div>
```

**Files:**
- `movie-nights/movie-nights.component.html:42–52` (results) and `:77–83` (detail)
- `suggestions/suggest-new.component.html:40–50` (results) and `:74–80` (detail)
- `suggestions/suggestions.component.html:66–77`
- `history/history.component.html:47–55` (card) and `:132–138` (detail)
- `ratings/ratings.component.html:55–61`
- `profile/profile-poster-grid.component.html:33–40`
- `profile/profile-suggestions.component.html:22–29`

**Recommendation:** Create `<app-movie-poster>` with inputs `posterUrl: string | null | undefined`, `title: string`, `size: 'sm' | 'md' | 'lg'` (drives a BEM modifier or CSS custom property). The placeholder SVG currently varies slightly between call sites; standardise it inside the component.

---

### 2.4 Back button + topbar structure — 8 files

Every full-page route uses an identical topbar: `ff-topbar` wrapper > `ff-icon-btn [block]__back` back button with inline back-chevron SVG > `ff-page-title` span > `ff-spacer` div. Only the page title string and the SVG `stroke` color change between files.

**Files:**
- `movie-nights/movie-nights.component.html:4–12` — stroke `#c04040`
- `suggestions/suggest-new.component.html:4–12` — stroke `#d4a03a`
- `suggestions/suggestions.component.html:4–17` — stroke `#d4a03a` (has extra action button — see §3.2)
- `history/history.component.html:4–12` — stroke `#4070d0`
- `ratings/ratings.component.html:4–12` — stroke `#c04040`
- `stats/stats.component.html:4–12` — stroke `#4070d0`
- `profile/profile.component.html:2–10` — stroke `#d4a03a`
- `bulk-import/bulk-import.component.html:4–12` — deviates (see §3.2)

**Recommendation:** Extract `<app-page-topbar>` with inputs `title: string`, `accentColor: string`, and an optional `ng-content` slot for the trailing action button. The SVG chevron is inlined eight times; it should live once. Fix the `bulk-import` deviation (§3.2) before extracting.

---

## 3. Systemic Inconsistencies

### 3.1 `empty` vs `ff-empty` — mixed empty-state class

Profile sub-components use a local `class="empty"` while all full-page components use the shared `ff-empty` utility class.

| Class used | Files |
|---|---|
| `class="empty"` | `profile/profile-genre-row.component.html:12`, `profile/profile-director-row.component.html:12`, `profile/profile-actor-row.component.html:12`, `profile/profile-suggestions.component.html:12`, `profile/profile-poster-grid.component.html:13` |
| `class="ff-empty"` | `history/history.component.html:20`, `stats/stats.component.html:25`, `ratings/ratings.component.html:24` |
| `class="ff-empty [block]__empty"` | `suggestions/suggestions.component.html:41` |

**Recommendation:** Migrate the five profile sub-component `empty` divs to `ff-empty`. If sub-components need tighter sizing, add a `ff-empty--compact` modifier rather than a separate class.

---

### 3.2 `bulk-import` topbar deviates from the shared pattern

All other pages use `<div class="ff-topbar">` with an `ff-icon-btn` back button. `bulk-import` rolls its own wrapper class and omits `ff-icon-btn`.

| Attribute | All other pages | `bulk-import/bulk-import.component.html:4–8` |
|---|---|---|
| Topbar wrapper | `class="ff-topbar"` | `class="bulk__topbar"` |
| Button classes | `class="ff-icon-btn [block]__back"` | `class="bulk__back"` (no `ff-icon-btn`) |
| `aria-label` | `"Go back"` | `"Go home"` |

**Recommendation:** Switch `bulk-import` to `ff-topbar` and add `ff-icon-btn` to the back button. Align `aria-label` to `"Go back"`. Resolves naturally when §2.4 topbar component is extracted.

---

### 3.3 Back button missing `aria-label` — `profile.component.html`

Every back button in the app has `aria-label="Go back"` except `profile/profile.component.html:3`, which has neither an `aria-label` nor any other accessible label.

**Affected file:** `profile/profile.component.html:3`

**Recommendation:** Add `aria-label="Go back"` to the back button on line 3. One-line fix.

---

### 3.4 `<h1>` vs `<span>` for page title in topbar

`profile/profile.component.html:8` uses `<h1 class="ff-page-title topbar__title">`. Every other page uses `<span class="ff-page-title [block]__title">`.

**Affected files:** all topbar-bearing pages

**Decision needed:** Pick one element and apply it consistently. `<h1>` is the better semantic choice for an SPA route view; if chosen, update all other topbars. Easiest to enforce when §2.4 is extracted.

---

### 3.5 Non-null assertion on `.split()` inconsistently applied

Four files use `director!.split(', ')` inside an `*ngIf="...director"` block (the `!` is redundant but harmless). `suggestions.component.html` omits it on the same pattern without the guard being any different.

| File | Expression |
|---|---|
| `movie-nights/movie-nights.component.html:88` | `selectedMovie.director!.split(', ')` |
| `suggestions/suggest-new.component.html:85` | `selected.director!.split(', ')` |
| `ratings/ratings.component.html:66` | `pending.movie.director!.split(', ')` |
| `history/history.component.html:148` | `night.movie.director!.split(', ')` |
| `suggestions/suggestions.component.html:88` | `card.movie.director.split(', ')` ← no `!` |

**Recommendation:** Remove the `!` from all four sites — the `*ngIf` already narrows the type. Resolves automatically when §2.2 (`<app-movie-search-picker>`) is extracted.

---

### 3.6 `/10` denominator display — inconsistently applied

Score displays differ in whether the `/10` denominator is shown and whether the span has a class.

| Style | File |
|---|---|
| `{{ score }}<span class="hist__group-score-denom">/10</span>` | `history/history.component.html:167` |
| `{{ score }}<span>/10</span>` (no class) | `ratings/ratings.component.html:45` |
| Raw `{{ value }}` (no denominator) | `history/history.component.html:88` (compact badge), `stats/stats.component.html` throughout |

**Decision needed:** Decide whether compact badges suppress `/10` and detail views show it, then apply consistently. The denominator span should use a single shared class (e.g. `ff-score-denom`) rather than an anonymous `<span>`.

---

## Priority Order

**High impact, low risk — do first:**
1. Add `aria-label="Go back"` to `profile/profile.component.html:3` — one-line fix, accessibility gap
2. Align `bulk-import` topbar: add `ff-topbar` wrapper and `ff-icon-btn` to the back button — two-line change, closes the §3.2 deviation before §2.4 extraction
3. Replace `class="empty"` with `class="ff-empty"` in the five profile sub-components (§3.1) — mechanical find-and-replace, no logic change

**Medium impact — do next:**
4. Remove the dead sort button from `profile/profile-poster-grid.component.html:4`
5. Remove the two stub `*ngSwitchCase` branches from `shared/components/rating-input/rating-input.component.html:24–36`
6. Extract `<app-profile-stat-row>` to collapse the three identical profile row templates (§2.1) — low-risk, all three already share the same binding names
7. Extract `<app-movie-poster>` (§2.3) — pure template refactor, no logic to move, unblocks the larger extractions

**Nice-to-have:**
8. Extract `<app-movie-search-picker>` (§2.2) — highest-value extraction, but requires coordinating two page components and their services
9. Extract `<app-page-topbar>` (§2.4) — straightforward once §3.2, §3.3, §3.4 are resolved first
10. Standardise `/10` denominator class (§3.6) — cosmetic, worth doing when score display is next touched
11. Decide `<h1>` vs `<span>` for topbar titles (§3.4) — trivially mechanical once the topbar component exists
