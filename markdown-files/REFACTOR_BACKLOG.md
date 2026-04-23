# Film Foodies — Refactor Backlog

> Derived from the April 2026 HTML, SCSS, and TypeScript audits. Items are ordered by impact and risk within each tier. Pick tasks from Tier 1 before moving to Tier 2.

---

## Tier 1 — High impact, low risk (do first)

These are one- or two-line changes that close known correctness or accessibility gaps.

### HTML fixes

- [ ] **`profile.component.html:3`** — Add `aria-label="Go back"` to the back button. It is the only back button in the app without this attribute. (HTML audit §3.3)
- [ ] **`bulk-import.component.html:4–8`** — Switch to `ff-topbar` wrapper and add `ff-icon-btn` to the back button. Change `aria-label` from `"Go home"` to `"Go back"`. (HTML audit §3.2)
- [ ] **Profile sub-component empty-states** — Replace `class="empty"` with `class="ff-empty"` in five files: `profile-genre-row`, `profile-director-row`, `profile-actor-row`, `profile-suggestions`, `profile-poster-grid`. (HTML audit §3.1)

### SCSS fixes

- [x] **`rating-input.component.scss:41–46`** — Delete the `.rating-stub` ruleset (commented "not visible in production UI"). (SCSS audit §1)
- [ ] **`profile.component.scss:1–7`** — Add `min-height: 100dvh` (after the existing `100vh` line) and `padding-bottom: env(safe-area-inset-bottom, 0px)`. Reference: `history.component.scss:3–10`. (SCSS audit §3.1)
- [ ] **`styles.scss`** — Add `--ff-placeholder: #3a3a3a` to the `:root` token block. Then replace all six hardcoded `#3a3a3a` `::placeholder` values across `ratings`, `movie-nights`, `suggest-new`, `history`, `admin` component SCSS files. (SCSS audit §2.7)
- [ ] **`suggestions.component.scss:14` and `suggest-new.component.scss:14`** — Move `padding-bottom: env(safe-area-inset-bottom, 0px)` from the inner flex container up to the `:host` block. (SCSS audit §3.2)
- [ ] **`history.component.scss:134–138`** — Verify `.hist__chip--blue` is not applied in `history.component.html`. If unused, delete lines 134–138. (SCSS audit §1)
- [ ] **`bulk-import.component.scss:167`** — Remove the redundant `box-sizing: border-box` on `.bulk__paste-area` (covered by global reset). (SCSS audit §1)

### TypeScript fixes

- [ ] **`profile.component.ts:50–76`** — Add `takeUntil(this.destroy$)` to the `forkJoin` subscription. (TS audit §3.2)
- [ ] **`bulk-import.component.ts:200–210`** — Add `takeUntil(this.destroy$)` or an explicit `unsubscribe()` to the callback-nested subscription. (TS audit §3.2)
- [ ] **`select-member.component.ts:126`** — Make `focusPin()` private (currently public but only called internally). (TS audit §1)
- [ ] **All services** — Add `console.error(...)` inside every silent `catchError` block. At minimum log the service name and method. (TS audit §3.3)

---

## Tier 2 — Medium impact (do next)

Structural improvements that reduce duplication and prevent new instances of the same patterns.

### New shared TypeScript utilities to create

- [x] **`SupabaseService.getClientOrNull()`** — Add one method to `SupabaseService`; then remove the per-service `private get client()` try/catch from all 9 services (`admin`, `omdb`, `ratings`, `suggestions`, `history`, `movie-nights`, `profile`, `bulk-import`, `stats`). (TS audit §2.2)
- [x] **`shared/util/destroy.ts`** — Create `DestroyComponent` base class with `protected readonly destroy$` and `ngOnDestroy`. Remove the boilerplate from all 8+ components that currently declare it manually. (TS audit §2.1)
- [x] **`shared/services/navigation.service.ts`** — Create `NavigationService` with `goBack()` and `goHome()`. Remove the per-component `goBack` / `goHome` / `navigate` methods from 10 components. (TS audit §2.3)
- [x] **`shared/util/language.ts`** — Extract `isNonEnglish(lang)`. Remove inline copies from `suggestions.component.ts:158`, `movie-nights.component.ts:202`, `history.component.ts:187`. (TS audit §2.4)
- [x] **`shared/util/date.ts`** — Extract `parseYyyyMmDd(s)`. Standardise the manual-split and `new Date(iso)` variants in `ratings.component.ts:160`, `history.component.ts:204`. (TS audit §2.5)
- [x] **`shared/util/score.ts`** — Extract `scoreColor(score)`. Remove inline copies from `history.component.ts:197`, `stats.component.ts:53`. (TS audit §2.6)

### New global SCSS utilities to add to `styles.scss`

- [-] **`.ff-empty__title`, `.ff-empty__sub`, `.ff-empty__btn`** — Add child rules to the existing `.ff-empty` block. Remove 3× duplicate `__empty-title / __empty-sub / __empty-btn` rulesets from `ratings`, `history`, `stats` component SCSS. (SCSS audit §2.6)
- [-] **`.ff-avatar--sm`** — Add `width: 28px; height: 28px; font-size: 0.75rem; border: 2px solid` modifier to the `.ff-avatar` block. Replace the two `28×28` avatar rules in `movie-nights` and `history`. (SCSS audit §2.9)
- [-] **`.ff-btn-gold`** — Add the gold ghost button (`rgba(212,160,58,0.12)` background, `rgba(212,160,58,0.35)` border, `var(--ff-gold)` color, `:active` state) to `styles.scss`. Replace 4 component-local copies in `suggestions`, `select-member`, `suggest-new`, `admin`. (SCSS audit §2.10)
- [-] **`%ff-page-host`** — Add SCSS placeholder for the canonical full-screen `:host` shell. Replace the verbatim `:host` block in 9 files with `@extend %ff-page-host`. (SCSS audit §2.2)

### Profile stylesheet deduplication

- [-] **Create `src/app/profile/_profile-row.scss`** — Extract the 70 identical lines shared by `profile-genre-row`, `profile-director-row`, `profile-actor-row` into a shared partial. Also include the `.section-header` / `.section-label` rules shared by `profile-trend-chart`, `profile-poster-grid`, `profile-suggestions`. Then `@use` the partial in each component file. (SCSS audit §2.1, §2.8)

### Local variable extraction

- [-] **`bulk-import.component.scss`** — Declare `$bulk-blue: #4070d0` and `$bulk-blue-hover: #5080e0` at the top of the file. Replace the 7 hardcoded occurrences. (SCSS audit §2.12)

### Profile token alignment

- [-] **All 8 profile sub-component SCSS files** — Replace bare hex values `#1a1a1a`, `#5a5a5a`, `#3a3a3a` with their `--ff-*` equivalents (`--ff-bg-card`, `--ff-text-6`, `--ff-border-mid`). Leave the warm tones (`#e0d0b0`, `#6a5030`, `#f0e0c0`) in place; add a comment in `profile-header.component.scss` explaining they are intentional Cinema palette values. (SCSS audit §3.6)

---

## Tier 3 — Nice-to-have (lower urgency / higher disruption)

These require product decisions or coordinating changes across multiple files.

### Shared component extractions

- [ ] **`<app-movie-poster>`** — Extract the `*ngIf posterUrl` + placeholder `div` pattern from 9+ files. Inputs: `posterUrl`, `title`, `size: 'sm' | 'md' | 'lg'`. (HTML audit §2.3)
- [ ] **`<app-profile-stat-row>`** — Collapse the three identical `profile-genre-row`, `profile-director-row`, `profile-actor-row` template + style files into one parameterised component. (HTML audit §2.1)
- [ ] **`<app-movie-search-picker>`** — Extract the 4-part movie search flow (input → results list → no-results hint → detail card) shared by `movie-nights` and `suggest-new`. (HTML audit §2.2 / SCSS audit §2.3–§2.5)
- [ ] **`<app-page-topbar>`** — Extract the topbar HTML from all 8 route components. Inputs: `title`, `accentColor`; optional content slot for trailing action button. Do this after all Tier 1 topbar fixes are in. (HTML audit §2.4)

### Systemic decisions required

- [ ] **Design token system** — Decide whether `--ff-*` or `--color-*` is canonical. Currently only `rating-input` uses `--color-*`; all other components use `--ff-*`. If `--ff-*` wins, define theme overrides for it and remove the `--color-*` block. If `--color-*` wins, migrate all components. (SCSS audit §3.3)
- [ ] **`@keyframes pulse` in `styles.scss:167–169`** — Replace hardcoded `#1a1a1a` / `#252525` with `var(--ff-bg-card)` / `var(--ff-bg-surface)` so skeleton loaders respond to theme changes. (SCSS audit §3.5)
- [ ] **`<h1>` vs `<span>` for page title** — Already decided in STYLE_GUIDE (`<h1>`). Apply uniformly to all pages that currently use `<span class="ff-page-title">`. Easiest after `<app-page-topbar>` extraction. (HTML audit §3.4)
- [ ] **`/10` score denominator class** — Decide: show denominator in detail views, suppress in compact badges. Standardise the class to `ff-score-denom`. (HTML audit §3.6)
- [ ] **Profile sub-component BEM naming** — Rename the flat class names (`.card`, `.row`, `.empty`, etc.) to `profile-*__*` BEM pattern. Bundle with any profile feature work. (SCSS audit §3.7)
- [ ] **Signal-based state** — Migrate stateful containers to Angular signal-based state (Angular 17+) to eliminate the `OnPush` + `markForCheck` ceremony. Long-term path. (TS audit §3.1)

### Shared track-by / constants

- [ ] **`shared/util/track-by.ts`** — Export `trackById`, `trackByMemberId`, `trackByImdbId`. Remove the ~14 per-component re-declarations. (TS audit §2.8)
- [ ] **`shared/constants/app-config.ts`** — Move `2500` (debounce), `5000` (undo timeout), `200` (import delay), avatar color list, and preset rating tags to named constants. (TS audit §3.4)
- [ ] **`lang badge` in `suggestions` and `history`** — Verify whether the size/opacity differences from the global `.ff-lang-badge` are intentional. If not, remove local copies and use the global class. (SCSS audit §2.11)

---

## Discovery stub

- [ ] **`discovery.component.html` / `.ts` / `.scss`** — Currently a `<div class="page-placeholder">Coming soon.</div>` stub. Remove from navigation or add a feature-flag guard until implemented. (HTML audit §1 / TS audit §1)
