---
name: SCSS audit findings
description: Dead code, duplication hotspots, and systemic improvements identified across all .scss files — use before proposing style refactors or new shared utilities
type: project
---

Audit performed 2026-04-15. Covers all files under src/**/*.scss.

Why: Baseline reference so future work doesn't re-introduce duplication already identified, and so dead styles stay on the radar.

How to apply: Before adding a new utility class or variable, check here first. Before touching a component's styles, check the "Systemic Inconsistencies" section to avoid making patterns worse.

---

## 1. Dead Code

| Finding | File(s) | Action |
|---------|---------|--------|
| Entire file is a single placeholder comment — no CSS rules | src/app/discovery/discovery.component.scss:1 | Delete file contents when implementing Discovery; leave placeholder comment only if needed |
| `.rating-stub` — explicitly commented "not visible in production UI" | src/app/shared/components/rating-input/rating-input.component.scss:41–46 | Delete the ruleset |
| `box-sizing: border-box` on `.bulk__paste-area` — redundant; the global `*, *::before, *::after { box-sizing: border-box }` reset in styles.scss:6–8 already covers this element | src/app/bulk-import/bulk-import.component.scss:167 | Remove the property |
| `.hist__chip--lang` (line 122) and `.hist__chip--blue` (line 134) have identical `color: #6080d0` and near-identical background/border values (only opacity differs by 0.02). `--blue` appears to be a redundant alias of `--lang` | src/app/history/history.component.scss:122–138 | Verify in template — if `--blue` is never applied to any element, delete lines 134–138 |

---

## 2. Duplication Hotspots

### 2.1 Identical profile-row component stylesheets — 3 files

All three files are character-for-character identical: same `:host`, `.row-header`, `.row-label`, `.row-more`, `.cards`, `.card`, `.card__rank`, `.card__name`, `.card__meta`, and `.empty` rules. The only thing distinguishing them is the filename.

Files:
- src/app/profile/profile-genre-row.component.scss:1–70
- src/app/profile/profile-director-row.component.scss:1–70
- src/app/profile/profile-actor-row.component.scss:1–70

Recommendation: Extract the shared rules into a new `src/app/profile/_profile-row.scss` partial (no `:host` — apply `display: block; padding: 0 16px` via the shared file), then `@use` it in each of the three component files. Each component file then contains only any variant-specific overrides (currently none).

---

### 2.2 Full-screen :host shell — 9 files

The pattern `display: block; min-height: 100dvh; background: var(--ff-bg); overflow-y: auto; padding-bottom: env(safe-area-inset-bottom, 0px)` (with a `100vh` fallback line before it) is repeated verbatim in every scrollable full-screen page.

Files:
- src/app/ratings/ratings.component.scss:3–10
- src/app/suggestions/suggestions.component.scss:3–9
- src/app/suggestions/suggest-new.component.scss:3–9
- src/app/movie-nights/movie-nights.component.scss:3–10
- src/app/history/history.component.scss:3–10
- src/app/stats/stats.component.scss:3–10
- src/app/admin/admin.component.scss:3–10
- src/app/bulk-import/bulk-import.component.scss:1–10 (uses `flex-direction: column` variant)
- src/app/profile/profile.component.scss:1–7 (incomplete — see §3.1)

Recommendation: Add a `%ff-page-host` SCSS placeholder (or a `.ff-page-host` utility class) to `src/styles.scss` containing the canonical block. Each component then extends it and only adds the properties that differ (e.g. `overflow: hidden` for home, `display: flex` for bulk-import). Angular `::ng-deep` is not needed — placeholders extend into the component's own `:host` rule.

---

### 2.3 Movie search input block — 2 files

Identical three-part pattern: relative wrapper + absolutely-positioned left icon + full-width 44 px input with `border-radius: 10px`, `padding: 0 40px 0 36px`, `background: var(--ff-bg-surface)`, `border: 1px solid var(--ff-border)`, `color: var(--ff-text)`, `font-size: 0.875rem`, `outline: none`.

Files:
- src/app/movie-nights/movie-nights.component.scss:52–79 (`.mn__search-wrap / __search-icon / __search`)
- src/app/suggestions/suggest-new.component.scss:27–53 (`.suggest-new__search-wrap / __search-icon / __search`)

Recommendation: Extract a `.ff-search-input` utility (wrapper + icon + input rules) to `src/styles.scss`. Components override only `border-color` on `:focus`.

---

### 2.4 Selected-movie detail card — 2 files

Identical card layout: `display: flex; gap: 12px; background: var(--ff-bg-card-alt); border: 1px solid var(--ff-border); border-radius: 10px; padding: 12px` with a 56×84 px poster, info column (`flex: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0`), and four identical child classes (title at `0.9375rem/600`, meta at `0.6875rem/text-4`, row with rating in gold and runtime in text-6, change-btn underline link).

Files:
- src/app/movie-nights/movie-nights.component.scss:160–240 (`.mn__detail-card` through `.mn__change-btn`)
- src/app/suggestions/suggest-new.component.scss:135–214 (`.suggest-new__detail-card` through `.suggest-new__change-btn`)

Recommendation: Extract a `%ff-detail-card` placeholder into `src/styles.scss` or a shared `_movie-card.scss` partial covering the card shell and info structure. Each component extends it and overrides focus color only.

---

### 2.5 Search results dropdown list — 2 files

Identical list container + row layout: `display: flex; flex-direction: column; margin: 8px 16px 0; background: var(--ff-bg-card-alt); border: 1px solid var(--ff-border); border-radius: 10px; overflow: hidden` with rows at `gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--ff-border-sub)` and a 30×44 px poster thumbnail plus baseline-aligned title/year.

Files:
- src/app/movie-nights/movie-nights.component.scss:90–156 (`.mn__results` through `.mn__no-results`)
- src/app/suggestions/suggest-new.component.scss:62–131 (`.suggest-new__results` through `.suggest-new__no-results`)

Recommendation: Same shared partial as 2.3/2.4 — all three movie-search patterns in mn and suggest-new could live in a single `src/app/shared/styles/_movie-search.scss` partial.

---

### 2.6 Empty-state title + sub + CTA button — 3 files

Three rules sets are character-for-character identical:

```scss
.__empty-title {
  font-family: Georgia, serif;
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--ff-text);
}
.__empty-sub { font-size: 0.8125rem; color: var(--ff-text-6); line-height: 1.5; }
.__empty-btn {
  margin-top: 12px;
  padding: 10px 24px;
  background: var(--ff-bg-surface);
  border: 1px solid var(--ff-border);
  border-radius: 8px;
  color: var(--ff-text-4);
  font-size: 0.875rem;
  cursor: pointer;
  &:active { background: var(--ff-bg-hover); }
}
```

Files:
- src/app/ratings/ratings.component.scss:54–79 (`.rate__empty-title / __empty-sub / __empty-btn`)
- src/app/history/history.component.scss:29–49 (`.hist__empty-title / __empty-sub / __empty-btn`)
- src/app/stats/stats.component.scss:46–66 (`.stats__empty-title / __empty-sub / __empty-btn`)

Recommendation: The global `.ff-empty` utility in `src/styles.scss:275–283` covers layout but not typography. Add `.ff-empty__title`, `.ff-empty__sub`, and `.ff-empty__btn` child rules directly to the `.ff-empty` block in `src/styles.scss`. Components using `.ff-empty` already emit the wrapper; they just need to use the child classes.

---

### 2.7 `#3a3a3a` placeholder text color — 6 files

The literal `#3a3a3a` is used exclusively for `::placeholder` color across all form inputs. It is not tokenised anywhere.

Files:
- src/app/ratings/ratings.component.scss:289, 319
- src/app/movie-nights/movie-nights.component.scss:276
- src/app/suggestions/suggest-new.component.scss:327
- src/app/history/history.component.scss:520
- src/app/admin/admin.component.scss:87

Recommendation: Add `--ff-placeholder: #3a3a3a;` to the `:root` token block in `src/styles.scss` and replace all six occurrences. One change covers every form.

---

### 2.8 Profile section header label — 3 files

Three components share identical `.section-header` + `.section-label` rules:

```scss
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.section-label {
  font-size: 0.625rem;
  font-weight: 700;
  color: var(--ff-gold-dim);
  text-transform: uppercase;
  letter-spacing: 2px;
}
```

Files:
- src/app/profile/profile-trend-chart.component.scss:4–15
- src/app/profile/profile-poster-grid.component.scss:4–15
- src/app/profile/profile-suggestions.component.scss:4–14

Recommendation: Add these two rules to the proposed `src/app/profile/_profile-row.scss` shared partial (see §2.1). All profile sub-components share the same section header pattern.

---

### 2.9 28×28 attendee avatar — 2 files

Identical rule blocks:

```scss
width: 28px; height: 28px;
border: 2px solid;
font-size: 0.75rem;
```

Files:
- src/app/movie-nights/movie-nights.component.scss:360–364 (`.mn__attendee-avatar`)
- src/app/history/history.component.scss:354–358 (`.hist__attendee-avatar`)

Recommendation: The global `.ff-avatar` in `src/styles.scss:265–272` covers `border-radius`, `display`, `font-family`, `font-weight`, and `color`, but not size. Add a `.ff-avatar--sm` modifier (`width: 28px; height: 28px; font-size: 0.75rem; border: 2px solid`) to `src/styles.scss` and use it in both templates.

---

### 2.10 Gold ghost button — 4 files

The `rgba(212, 160, 58, 0.12)` background + `rgba(212, 160, 58, 0.35)` border + `color: var(--ff-gold)` ghost button appears as the gold affirmative action button across multiple contexts.

Files:
- src/app/suggestions/suggestions.component.scss:135–148 (`.suggestions__empty-cta`, `border-radius: 20px`)
- src/app/select-member/select-member.component.scss:207–218 (`.select-member__settings-btn`, `border-radius: 20px`)
- src/app/suggestions/suggest-new.component.scss:353–368 (`.suggest-new__submit`, `height: 48px; border-radius: 10px`)
- src/app/admin/admin.component.scss:124–129 (`.admin__btn--primary`, `border-radius: 8px`)

Recommendation: Add a `.ff-btn-gold` utility class to `src/styles.scss` with the shared background/border/color rules. Radius, height, and font-size stay per-component. The `active` state (`rgba(212, 160, 58, 0.2)`) is also shared and can be included.

---

### 2.11 Lang badge replicated from global utility — 2 files

`src/styles.scss:252–261` defines `.ff-lang-badge` globally. Two components define their own local copies instead of using it.

Files:
- src/app/suggestions/suggestions.component.scss:284–294 (`.suggestions__lang-badge` — `font-size: 0.5rem` vs global `0.5625rem`; adds `text-transform: uppercase`)
- src/app/history/history.component.scss:122–127 (`.hist__chip--lang` — opacity `0.12/0.22` vs global `0.15/0.25`)

Recommendation: Verify whether the size/opacity deltas are intentional. If not, remove the local copies and apply `.ff-lang-badge` directly in the templates. If the differences are intentional (suggestions wants uppercase, history wants lower opacity), document that in a comment next to each local rule.

---

### 2.12 Blue action button `#4070d0` — 4 occurrences in one file

The value `#4070d0` (primary blue action) and its hover `#5080e0` appear four times within a single file with no local variable.

File:
- src/app/bulk-import/bulk-import.component.scss:192, 337, 388, 449 (`background: #4070d0`)
- src/app/bulk-import/bulk-import.component.scss:199, 346, 457 (`hover: #5080e0`)

Recommendation: Declare `$bulk-blue: #4070d0` and `$bulk-blue-hover: #5080e0` at the top of `bulk-import.component.scss` and substitute all seven hard-coded values.

---

## 3. Systemic Inconsistencies

### 3.1 profile.component.scss missing 100dvh and safe-area inset

Every other full-screen page component uses `min-height: 100dvh` (with a `100vh` fallback) and `padding-bottom: env(safe-area-inset-bottom, 0px)`. Profile has only `min-height: 100vh` and no safe-area padding at all. On iPhone with home indicator, the bottom content will be obscured.

Affected files:
- src/app/profile/profile.component.scss:1–7 (missing both)

Compare against canonical pattern: src/app/history/history.component.scss:3–10

Decision needed: Update profile.component.scss `:host` to match the canonical pattern: add `min-height: 100dvh` after `min-height: 100vh`, and add `padding-bottom: env(safe-area-inset-bottom, 0px)`.

---

### 3.2 `padding-bottom: env(safe-area-inset-bottom)` placed inconsistently

Most components apply safe-area padding on `:host`. Two apply it on the inner flex container instead.

Applied on `:host`: bulk-import:5, home:5, select-member:9, ratings:9, movie-nights:9, history:9, stats:9, admin:9

Applied on inner element instead of `:host`:
- src/app/suggestions/suggestions.component.scss:14 (`.suggestions`)
- src/app/suggestions/suggest-new.component.scss:14 (`.suggest-new`)

Decision needed: Standardise on `:host` (matching the majority pattern and the documented project convention). Move the `padding-bottom` in suggestions and suggest-new up to their `:host` block.

---

### 3.3 Two parallel design token systems — `--ff-*` vs `--color-*`

`styles.scss` defines two separate `:root` blocks: a `--ff-*` set (lines 23–51) used by almost every component, and a `--color-*` set (lines 57–84) with full theme-switching support. These two systems cover overlapping concerns without being linked.

`rating-input.component.scss` is the only component using `--color-*` tokens (`--color-surface-raised`, `--color-border`, `--color-text`, `--color-accent`). All other components use `--ff-*` tokens. This means only rating-input responds to the Lobby/High-Contrast/Forest/Anti-Glare theme switches; no other component does.

Affected files: src/app/shared/components/rating-input/rating-input.component.scss:11–15, 27

Decision needed: Decide which token system is canonical. If `--ff-*` is the future, define corresponding theme overrides for it. If `--color-*` is the future, migrate all `--ff-*` usages. The current split means theme switching has no visible effect on 99% of the UI.

---

### 3.4 Focus outline color inconsistency — three different values in use

The project convention (per memory and the `focus-visible gold outlines` note) is `outline: 2px solid var(--ff-gold)`. Three screen-colour themes break this:

Using `#c04040` (red) for focus:
- src/app/ratings/ratings.component.scss:20, 78, 233, 260, 343, 366, 383
- src/app/movie-nights/movie-nights.component.scss:20, 113, 239, 357, 406, 458, 508

Using `#4070d0` (blue) for focus:
- src/app/history/history.component.scss:17, 49, 64, 65, 197, 504, 548, 566
- src/app/stats/stats.component.scss:17, 65

Using `var(--ff-gold)` (correct): bulk-import, suggestions, suggest-new, admin, select-member

Decision needed: Either (a) standardise all focus outlines to `var(--ff-gold)` per the stated convention, or (b) explicitly document that focus color matches the screen accent (red for ratings/movie-nights, blue for history/stats) as an intentional accessibility affordance — and add a comment to each file explaining this.

---

### 3.5 `--color-*` theme tokens ignored by `@keyframes pulse` in styles.scss

`styles.scss:167–169` defines `@keyframes pulse` with hard-coded `#1a1a1a` and `#252525` background values. These bypass both the `--ff-*` and `--color-*` token systems, so skeleton loaders do not respond to theme changes (e.g. in Lobby Mode they would flash dark grey instead of light grey).

Affected files: src/styles.scss:167–169

Decision needed: Replace `#1a1a1a` / `#252525` with `var(--ff-bg-card)` / `var(--ff-bg-surface)` so skeletons adapt to the active theme.

---

### 3.6 Profile sub-components use hard-coded hex values instead of `--ff-*` tokens

All eight profile sub-components (`profile-header`, `profile-genre-row`, `profile-director-row`, `profile-actor-row`, `profile-trend-chart`, `profile-poster-grid`, `profile-suggestions`, `profile-contrarian`) use bare hex values that have exact `--ff-*` equivalents:

| Hard-coded value | --ff-* equivalent |
|-----------------|-------------------|
| `#1a1a1a` | `var(--ff-bg-card)` |
| `#5a5a5a` | `var(--ff-text-6)` |
| `#3a3a3a` | `var(--ff-border-mid)` |
| `#6a6a6a` | (no exact match — between text-6 `#555` and text-5 `#666`) |
| `#e0d0b0` | (warm text — no `--ff-*` equivalent; intentional design divergence) |
| `#6a5030` | (warm dim — no `--ff-*` equivalent; intentional) |
| `#f0e0c0` | (warm light — no `--ff-*` equivalent; intentional) |

The warm tones (`#e0d0b0`, `#f0e0c0`, `#6a5030`) appear to be intentional Cinema-palette styling specific to the profile. The neutral greys (`#1a1a1a`, `#5a5a5a`, `#3a3a3a`) are plain token misses.

Affected files: All eight profile sub-component SCSS files

Decision needed: Replace `#1a1a1a`, `#5a5a5a`, and `#3a3a3a` occurrences with their `--ff-*` tokens. Leave the warm tones as-is, but add a comment in `profile-header.component.scss` explaining that warm palette values are intentional.

---

### 3.7 BEM naming in page components vs flat naming in profile sub-components

All page-level components use namespaced BEM (`rate__back`, `mn__search`, `hist__card`, etc.), which prevents class collisions under Angular's scoped CSS. The profile sub-components use entirely flat, un-namespaced class names: `.card`, `.row`, `.section-header`, `.empty`, `.pill`, `.avatar`, `.chips`, `.badge`, `.cell`, `.vote`. Angular's ViewEncapsulation prevents current collisions, but if encapsulation is changed to `None` for any reason, or if these components are ever server-side rendered, these flat names will collide with other styles.

Affected files: src/app/profile/profile-header.component.scss, profile-genre-row.component.scss, profile-director-row.component.scss, profile-actor-row.component.scss, profile-trend-chart.component.scss, profile-poster-grid.component.scss, profile-suggestions.component.scss, profile-contrarian.component.scss

Decision needed: Low urgency under ViewEncapsulation. When the profile sub-components are touched for other reasons (e.g. the §2.1 row deduplication), rename classes to the `profile-*__*` BEM pattern at the same time.

---

## Priority Order

**Do first (high impact, low risk):**

1. **Delete `.rating-stub`** — rating-input.component.scss:41–46. Zero risk, one class removed.
2. **Fix profile.component.scss safe-area and 100dvh** — two-line change, prevents content cut-off on iPhone (§3.1).
3. **Add `--ff-placeholder: #3a3a3a` token** — one addition to styles.scss, six substitutions across six files; no visual change (§2.7).
4. **Delete `.rating-stub`-adjacent: standardise `padding-bottom: env(...)` to `:host`** in suggestions.component.scss:14 and suggest-new.component.scss:14 — two one-line moves (§3.2).
5. **Verify and delete `.hist__chip--blue`** — check history template; if unused, remove 6 lines (§1, row 4).

**Do next (medium impact):**

6. **Deduplicate profile-genre/director/actor-row** — extract shared 70-line stylesheet to `_profile-row.scss` (§2.1).
7. **Extract `.ff-empty__title`, `.ff-empty__sub`, `.ff-empty__btn`** into the existing `.ff-empty` block in styles.scss; remove 3× duplicate rulesets (§2.6).
8. **Add `.ff-avatar--sm`** modifier to styles.scss; replace the two 28×28 avatar blocks (§2.9).
9. **Add `.ff-btn-gold` utility** to styles.scss; replace 4 component-local gold ghost button rulesets (§2.10).
10. **Extract shared movie-search partials** for mn and suggest-new (§2.3–2.5) — high code reduction but requires template changes to adopt shared class names.
11. **Add `$bulk-blue` local variable** in bulk-import.component.scss (§2.12) — single-file, no template impact.

**Nice-to-have (low impact / higher disruption):**

12. **Resolve `--ff-*` vs `--color-*` token split** — needs a product decision on which system is canonical before any code change (§3.3).
13. **Standardise focus outline color** — either gold everywhere or document the intentional per-screen-color approach (§3.4).
14. **Fix `@keyframes pulse` to use tokens** — low visual impact today, enables future theming (§3.5).
15. **Migrate profile sub-components off bare hex values** — medium effort, do alongside any profile feature work (§3.6).
16. **Rename profile sub-component classes to BEM** — low urgency, bundle with §3.6 work (§3.7).
