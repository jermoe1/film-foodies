# Film Foodies — Style Guide for AI Agents

This file is the single reference for writing new features consistently.
Read this before touching any code. Companion files: `CONTEXT.md` (product decisions), `supabase/schema.sql` (database).

---

## Table of Contents

1. [Project Constraints (Read First)](#1-project-constraints-read-first)
2. [Design Tokens](#2-design-tokens)
3. [Typography](#3-typography)
4. [Component Visual Patterns](#4-component-visual-patterns)
5. [SCSS Conventions](#5-scss-conventions)
6. [Angular Architecture](#6-angular-architecture)
7. [Data & Services](#7-data--services)
8. [Routing & Auth](#8-routing--auth)
9. [RxJS Patterns](#9-rxjs-patterns)
10. [Template Patterns](#10-template-patterns)
11. [Common Mistakes to Avoid](#11-common-mistakes-to-avoid)

---

## 1. Project Constraints (Read First)

These are hard constraints. Violating them will break the app.

| Constraint | Detail |
|---|---|
| **HashLocationStrategy** | URLs are `/#/route`. Never use `RouterLink` with absolute paths that assume HTML5 history. Never add a `<base href>` redirect in the router — it's set at build time via `--base-href`. |
| **GitHub Pages hosting** | Static files only. No SSR, no server routes, no API proxy. All backend calls go through Supabase. |
| **No direct Supabase calls from components** | Every DB interaction must go through a service that returns an `Observable`. Components call service methods, subscribe, and update local state. |
| **OnPush everywhere** | Every component uses `ChangeDetectionStrategy.OnPush`. Call `this.cdr.markForCheck()` after any async state change. |
| **`100dvh` + safe area on every scroll screen** | See [Section 5 — Safe Area](#safe-area--scroll-pattern). Skipping this breaks the layout on mobile browsers. |
| **Soft deletes on `movie_suggestions` only** | Every query on `movie_suggestions` must include `.is('deleted_at', null)`. All other tables use hard deletes. |
| **OMDB rate limit** | 1,000 calls/day. Never call OMDB on every keystroke. Search debounce is 2,500ms or Enter. Bulk operations use `concatMap` + `delay(200)`. Always check DB cache before calling OMDB. |
| **No accounts — name picker only** | Identity is stored in localStorage (`ff_current_member_id`). No passwords per user. Site-wide passcode is a separate system in `AuthService`. |
| **max-width: 480px on desktop** | All page containers cap at 480px centered. The app is phone-first. |

---

## 2. Design Tokens

### Colors

```scss
// Backgrounds
$bg-base:        #0d0d0d;   // Page background — every :host
$bg-card:        #141414;   // Card/surface background
$bg-card-hover:  #1a1a1a;   // Hover state on cards
$bg-card-alt:    #161616;   // Alternate card (select-member cards)
$bg-input:       #141414;   // Input fields
$bg-elevated:    #1e1e1e;   // Slightly elevated surfaces

// Borders
$border-subtle:  #1e1e1e;   // Row dividers
$border-default: #2a2a2a;   // Card borders, table borders
$border-strong:  #333;      // Button borders, input borders
$border-muted:   #444;      // Less prominent borders

// Brand / Accent
$gold:           #d4a03a;   // Primary accent — logo, links, focus rings, CTA highlights
$gold-dim:       #8a6030;   // Tagline, secondary gold text
$gold-bg:        rgba(212, 160, 58, 0.12);  // Gold tinted backgrounds
$gold-border:    rgba(212, 160, 58, 0.35);  // Gold tinted borders

// Panel / Section colors
$blue:           #4070d0;   // Primary action buttons, progress bars, history panel
$blue-hover:     #5080e0;
$crimson:        #c04040;   // Movie Night panel, error states, destructive actions
$crimson-hover:  #d04050;

// Text
$text-primary:   #e8e8e8;   // Body text
$text-secondary: #ccc;      // Secondary text
$text-muted:     #888;      // Hints, placeholders, meta info
$text-faint:     #666;      // Very low emphasis
$text-ghost:     #555;      // Near-invisible supporting text
$text-disabled:  #444;      // Disabled labels

// Semantic
$green:          #4a9a5a;   // Success, "ready" badges, checkmarks, attending state
$score-high:     #4a9a5a;   // Ratings ≥ 7.5
$score-mid:      #d4a03a;   // Ratings 5.0–7.4 (reuse gold)
$score-low:      #c04040;   // Ratings < 5.0
```

### Score Color Thresholds

```typescript
// Use in component helpers
scoreColor(score: number | null): string {
  if (score === null) return '#666';
  if (score >= 7.5)  return '#4a9a5a';
  if (score >= 5.0)  return '#d4a03a';
  return '#c04040';
}
```

### Shadows & Overlays

```scss
// Dark gradient for header overlays on image panels
background: linear-gradient(180deg, rgba(8,3,0,0.97) 0%, rgba(8,3,0,0.85) 60%, transparent 100%);

// Subtle card elevation
box-shadow: 0 1px 3px rgba(0,0,0,0.4);
```

---

## 3. Typography

### Font Families

```scss
// UI text — inherits system font stack from body
font-family: inherit;  // -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif

// Logo / display only
font-family: Georgia, serif;
```

### Type Scale

| Role | Size | Weight | Color |
|---|---|---|---|
| Logo title | `1.375rem – 1.5rem` | 700 | `#d4a03a` |
| Logo tagline | `0.625rem` | 400 | `#8a6030`, letter-spacing: 3px, uppercase |
| Page title / topbar | `1rem` | 600 | `#e8e8e8` |
| Section label | `0.7rem – 0.75rem` | 600 | `#888`, letter-spacing: 0.06em, uppercase |
| Card title | `0.9rem – 1rem` | 600 | `#e8e8e8` |
| Body / field labels | `0.85rem – 0.88rem` | 400–500 | `#ccc` |
| Meta / hints | `0.78rem – 0.82rem` | 400 | `#888` |
| Captions / badges | `0.72rem – 0.75rem` | 400–600 | varies |
| Monospace (CSV, code) | `0.78rem` | 400 | `#ddd`, font-family: 'Courier New', monospace |

---

## 4. Component Visual Patterns

### Topbar

Every detail/form screen has a consistent topbar:

```html
<div class="[prefix]__topbar">
  <button class="[prefix]__back" (click)="goBack()" aria-label="Go back">
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M12 5L7 10L12 15" stroke="#d4a03a" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>
  <span class="[prefix]__title">Page Title</span>
  <div class="[prefix]__spacer"></div>
</div>
```

```scss
.[prefix]__topbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 0 12px;
  flex-shrink: 0;
}
.[prefix]__back {
  width: 36px; height: 36px;
  background: none; border: none; cursor: pointer; padding: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 8px;
  &:focus-visible { outline: 2px solid #d4a03a; outline-offset: 2px; }
}
.[prefix]__title { font-size: 1rem; font-weight: 600; color: #e8e8e8; }
.[prefix]__spacer { flex: 1; }
```

Note: The back chevron uses `#d4a03a` (gold) on most screens. Movie Nights uses `#c04040` (crimson) to match its panel color.

### Section Labels

```html
<div class="[prefix]__section-label">Label Text</div>
```

```scss
.[prefix]__section-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: #888;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin: 0 0 10px;
  &--mt { margin-top: 22px; }  // when stacking multiple sections
}
```

### Form Inputs & Selects

```scss
.[prefix]__input,
.[prefix]__select {
  width: 100%;
  background: #141414;
  border: 1px solid #333;
  border-radius: 8px;
  color: #e8e8e8;
  font-size: 0.9rem;
  padding: 10px 12px;
  box-sizing: border-box;
  &::placeholder { color: #555; }
  &:focus { outline: 2px solid #d4a03a; outline-offset: -1px; border-color: transparent; }
}
.[prefix]__select { appearance: none; cursor: pointer; }
```

### Primary Action Button (Submit / CTA)

```scss
.[prefix]__submit {
  width: 100%;
  background: #4070d0;   // or #c04040 for crimson-themed screens
  border: none;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  padding: 14px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s;
  &:hover:not(:disabled) { background: #5080e0; }
  &:disabled { opacity: 0.45; cursor: default; }
  &:focus-visible { outline: 2px solid #d4a03a; outline-offset: 2px; }
}
```

### Loading Skeleton

```scss
.skeleton {
  background: linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 8px;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Apply the `skeleton` class directly to the element. No wrapper needed.

### Empty State

```html
<div class="[prefix]__empty">
  <!-- SVG icon -->
  <p class="[prefix]__empty-title">Headline</p>
  <p class="[prefix]__empty-sub">Supporting text.</p>
  <button class="[prefix]__empty-cta" (click)="action()">CTA Label</button>
</div>
```

```scss
.[prefix]__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
  padding: 48px 24px;
}
.[prefix]__empty-title { font-size: 0.95rem; font-weight: 600; color: #e8e8e8; margin: 0; }
.[prefix]__empty-sub   { font-size: 0.82rem; color: #666; line-height: 1.5; max-width: 260px; margin: 0; }
```

### Error / Success Inline Messages

```html
<div class="[prefix]__error"   *ngIf="submitError">{{ submitError }}</div>
<div class="[prefix]__success" *ngIf="submitSuccess">Action completed!</div>
```

```scss
.[prefix]__error   { color: #c04040; font-size: 0.82rem; text-align: center; padding: 4px 0; }
.[prefix]__success { color: #4a9a5a; font-size: 0.82rem; text-align: center; padding: 4px 0; }
```

### Movie Search Result Row

Used in movie-nights and suggest-new — same HTML structure, different BEM prefix:

```html
<button class="[prefix]__result" (click)="selectMovie(r)">
  <img *ngIf="r.posterUrl" [src]="r.posterUrl" [alt]="r.title" class="[prefix]__result-poster"/>
  <div *ngIf="!r.posterUrl" class="[prefix]__result-poster [prefix]__result-poster--placeholder">
    <!-- film reel SVG placeholder -->
  </div>
  <div class="[prefix]__result-info">
    <span class="[prefix]__result-title">{{ r.title }}</span>
    <span class="[prefix]__result-year" *ngIf="r.releaseYear">{{ r.releaseYear }}</span>
    <span *ngIf="r.movieLanguage && !r.movieLanguage.toLowerCase().startsWith('english')"
          class="[prefix]__result-lang">{{ r.movieLanguage.split(', ')[0] }}</span>
  </div>
  <!-- chevron SVG -->
</button>
```

Language badge rule: show only when `movieLanguage` is non-null and does NOT start with "English".

### Spinner

```scss
.[prefix]__spinner {
  width: 18px; height: 18px;
  border: 2px solid #2a2a2a;
  border-top-color: #d4a03a;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }
```

### Focus Ring (Global Rule)

All interactive elements must have:

```scss
&:focus-visible { outline: 2px solid #d4a03a; outline-offset: 2px; }
```

Never use `outline: none` without replacing it with the gold focus ring.

---

## 5. SCSS Conventions

### BEM Naming

Every component has a unique BEM block prefix:

| Component | Prefix |
|---|---|
| HomeComponent | `.home` |
| MovieNightsComponent | `.mn` |
| SuggestionsComponent | `.suggestions` |
| SuggestNewComponent | `.suggest-new` |
| HistoryComponent | `.history` |
| StatsComponent | `.stats` |
| ProfileComponent | `.profile` |
| AdminComponent | `.admin` |
| BulkImportComponent | `.bulk` |
| SelectMemberComponent | `.select-member` |
| RatingsComponent | `.rate` |

Pattern: `.prefix__element` and `.prefix__element--modifier`.
No nesting deeper than `.[prefix]__element { &--modifier {} }`.

### Host Block

Every component's `:host` is the scroll container:

```scss
:host {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;               // or height: 100dvh for non-scrolling screens
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: #0d0d0d;
  color: #e8e8e8;
  font-family: inherit;
  overflow-y: auto;                 // on scrollable pages
  // overflow: hidden;             // only on home (three-panel non-scroll layout)
}
```

### Safe Area + Scroll Pattern

**Required on every route component.** No exceptions.

```scss
// Scrollable screen (most screens)
:host {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  height: 100vh; height: 100dvh;   // fallback + modern
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow-y: auto;
}

// Non-scrolling screen (home only)
:host {
  display: block;
  height: 100vh; height: 100dvh;
  padding-bottom: env(safe-area-inset-bottom, 0px);
  overflow: hidden;
}
```

Bottom padding / sticky footer spacing:

```scss
.[prefix]__footer {
  padding: 16px 0;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  // or use the bottom-pad spacer div approach:
}
.[prefix]__bottom-pad { height: 32px; flex-shrink: 0; }
```

### Max-Width Container

Every page content wrapper:

```scss
.[prefix] {
  max-width: 480px;
  width: 100%;
  margin: 0 auto;
  padding: 0 16px;
}
```

### SCSS Structure Order

Within a component SCSS file, sections appear in this order:
1. `:host` block
2. Root container (`.prefix {}`)
3. Topbar
4. Section-by-section, top to bottom as they appear in the template
5. Modifiers and state classes at end of each block

---

## 6. Angular Architecture

### Module Structure

```
app/
├── app.module.ts          # Root: BrowserModule, CoreModule, AppRoutingModule, HashLocationStrategy
├── app-routing.module.ts  # Lazy-loaded routes; authGuard on all routes except /select-member, /admin
├── core/
│   ├── core.module.ts     # Imported once in AppModule; never in feature modules
│   ├── services/          # All singleton services (SupabaseService, OmdbService, MemberService, AuthService, ThemeService)
│   └── guards/            # authGuard (functional CanActivateFn)
├── shared/
│   ├── shared.module.ts   # Exports CommonModule, FormsModule, ReactiveFormsModule, RouterModule, shared components
│   └── components/
│       └── rating-input/  # RatingInputComponent — the only shared component
└── [feature]/
    ├── [feature].module.ts         # imports SharedModule + routing
    ├── [feature]-routing.module.ts
    ├── [feature].component.ts
    ├── [feature].component.html
    ├── [feature].component.scss
    └── [feature].service.ts        # Feature-specific service (if needed)
```

### Feature Module Template

```typescript
@NgModule({
  declarations: [FeatureComponent],
  imports: [SharedModule, FeatureRoutingModule],
})
export class FeatureModule {}
```

Never import `CommonModule`, `FormsModule`, or `RouterModule` directly in a feature module — they come through `SharedModule`.

### Component Template

```typescript
@Component({
  selector: 'app-feature',
  templateUrl: './feature.component.html',
  styleUrls: ['./feature.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureComponent implements OnInit, OnDestroy {
  // Public state (bound in template)
  isLoading = true;
  data: SomeType[] = [];
  submitError: string | null = null;

  // Private
  private readonly destroy$ = new Subject<void>();

  constructor(
    private featureService: FeatureService,
    private router: Router,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.featureService.getData()
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
        this.data = data;
        this.isLoading = false;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void { this.router.navigate(['/home']); }

  trackById(_: number, item: SomeType): string { return item.id; }
}
```

Rules:
- Always `ChangeDetectionStrategy.OnPush`
- Always `takeUntil(this.destroy$)` on every subscription
- Always call `this.cdr.markForCheck()` after any async state change
- Always implement `OnDestroy` if there are any subscriptions
- `trackBy` functions required on all `*ngFor` lists
- Never use `async` pipe in templates — subscribe in the component and store in a property

---

## 7. Data & Services

### Service Template

```typescript
@Injectable({ providedIn: 'root' })
export class FeatureService {
  constructor(private supabase: SupabaseService) {}

  private get client() {
    try { return this.supabase.getClient(); } catch { return null; }
  }

  getData(): Observable<SomeType[]> {
    const client = this.client;
    if (!client) return of([]);

    return from(
      client.from('table').select('*').order('created_at', { ascending: false })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as SomeType[];
      }),
      catchError(() => of([]))
    );
  }
}
```

Key rules:
- `private get client()` pattern with try/catch — never call `getClient()` directly without guarding
- Always wrap Supabase calls in `from()` to get an Observable
- Always `catchError(() => of(fallback))` — services never throw to components
- Services return Observables; components subscribe

### Supabase Query Patterns

```typescript
// Single row
from(client.from('table').select('*').eq('id', id).single())

// Optional single (won't error if missing)
from(client.from('table').select('*').eq('imdb_id', x).maybeSingle())

// Insert and return id
from(client.from('table').insert(row).select('id').single())

// Update
from(client.from('table').update({ field: val }).eq('id', id))

// RPC
from(client.rpc('function_name', { param: value }))

// IMPORTANT: Always filter soft-deleted suggestions
client.from('movie_suggestions').select('*').is('deleted_at', null)
```

### OMDB Usage Rules

```typescript
// 1. Always check DB before calling OMDB
// 2. Use getOrCacheMovie(imdbId) — never call OMDB directly for detail fetches
// 3. Search: DB first, OMDB only if <3 DB results
// 4. Bulk/batch: concatMap + delay(200) — never parallel OMDB calls
// 5. Search trigger: 2500ms debounce OR Enter key (merge pattern)

merge(
  this.query$.pipe(debounceTime(2500), distinctUntilChanged()),
  this.searchNow$
).pipe(switchMap((q) => this.omdbService.searchMovies(q)))
```

### MovieSearchResult Type

Defined in `src/app/suggestions/suggestions.types.ts`. Used by movie-nights and suggest-new:

```typescript
export interface MovieSearchResult {
  id: string | null;       // DB uuid — null if OMDB-only (not yet cached)
  imdbId: string;
  title: string;
  releaseYear: string | null;
  posterUrl: string | null;
  genre: string | null;
  director: string | null;
  runtime: string | null;
  imdbRating: string | null;
  imdbUrl: string | null;
  movieLanguage: string | null;
  country: string | null;
  inDb: boolean;           // true = exists in movies table
}
```

When `inDb` is false, always call `omdbService.getOrCacheMovie(imdbId)` before any DB reference.

---

## 8. Routing & Auth

### Route Guard

`authGuard` (functional) protects all routes except `/select-member` and `/admin`. It checks `authService.isAuthenticated` (localStorage flag). On failure it redirects to `/select-member`.

Never import `AuthGuard` as a class — it's a functional guard:

```typescript
import { authGuard } from './core/guards/auth.guard';
// In routes:
{ path: 'feature', canActivate: [authGuard], loadChildren: () => ... }
```

### Auth Flow

1. New device → `authGuard` blocks → `/select-member`
2. `SelectMemberComponent` calls `authService.hasPasscode()`
   - Passcode set → show 6-dot PIN entry → on success → member picker
   - No passcode → `authService.markAuthenticated()` → member picker
3. Member selected → `memberService.selectMember(member)` → `/home`
4. Returning device (localStorage has both flags) → guard passes → `AppComponent` restores member → `/home`

### Passcode Lifecycle

- Set by admin in `/admin` via `authService.setPasscode(code)` → hashes with SHA-256 → stores in `app_settings.passcode_hash`
- `setPasscode` calls `clearVerification()` — invalidates all cached sessions site-wide on next visit
- `isAuthenticated` = `localStorage.getItem('ff_passcode_verified') === 'true'`

### Navigation Patterns

```typescript
// Go back to home
this.router.navigate(['/home']);

// Go back to parent list
this.router.navigate(['/suggest']);

// Go to movie night with suggestion pre-filled
this.router.navigate(['/movie-night'], { queryParams: { suggestion: id } });
```

---

## 9. RxJS Patterns

### Parallel queries (forkJoin)

```typescript
forkJoin([
  this.serviceA.getData(),
  this.serviceB.getData(),
]).pipe(
  map(([a, b]) => computeResult(a, b))
)
```

### Sequential with delay (bulk/batch operations)

```typescript
from(items).pipe(
  concatMap((item) =>
    this.processOne(item).pipe(delay(200), catchError(() => of(fallback)))
  ),
  toArray(),
)
```

### Cancellable search (debounce + immediate)

```typescript
// Component state
private readonly query$ = new Subject<string>();
private readonly searchNow$ = new Subject<string>();

// Setup in ngOnInit
merge(
  this.query$.pipe(debounceTime(2500), distinctUntilChanged()),
  this.searchNow$
).pipe(
  switchMap((q) => {
    if (!q.trim()) { this.results = []; return of([]); }
    this.isSearching = true;
    return this.omdbService.searchMovies(q);
  }),
  takeUntil(this.destroy$)
).subscribe((results) => {
  this.results = results ?? [];
  this.isSearching = false;
  this.cdr.markForCheck();
});

// On input change
onQueryChange(value: string): void {
  this.query = value;
  this.query$.next(value);
}

// On Enter key
onSearchEnter(): void {
  if (this.query.trim()) this.searchNow$.next(this.query);
}
```

### Teardown

Every subscription in a component must use `takeUntil(this.destroy$)`:

```typescript
someObservable$.pipe(takeUntil(this.destroy$)).subscribe(...)
```

Fire-and-forget one-liners (e.g. mark suggestion as selected) don't need teardown — they complete immediately. But `takeUntil` is still recommended for safety.

---

## 10. Template Patterns

### ngIf vs ng-container

Use `ng-container` for structural directives when you don't want an extra DOM element:

```html
<ng-container *ngIf="isLoading">...</ng-container>
```

Use element-level `*ngIf` when the element itself is the natural host.

### trackBy — Required on all ngFor

```html
<div *ngFor="let item of items; trackBy: trackById">
```

```typescript
trackById(_: number, item: SomeType): string { return item.id; }
```

### Input binding vs event binding

```html
<!-- Two-way (forms) -->
[(ngModel)]="fieldName"

<!-- One-way read -->
[value]="query"

<!-- Event — use $any() cast for input events -->
(input)="onInput($any($event.target).value)"

<!-- Keyboard shortcut -->
(keydown.enter)="onSearchEnter()"
```

### Disabled button pattern

```html
<button [disabled]="!canSubmit || isSubmitting" (click)="onSubmit()">
  <span *ngIf="!isSubmitting && !submitSuccess">Submit</span>
  <span *ngIf="isSubmitting">Saving…</span>
  <span *ngIf="submitSuccess">Saved ✓</span>
</button>
```

`canSubmit` is a getter that validates required fields. Never inline validation logic in the template.

### Conditional CSS classes

```html
<div
  class="[prefix]__item"
  [class.[prefix]__item--active]="isActive"
  [class.[prefix]__item--error]="hasError"
>
```

---

## 11. Common Mistakes to Avoid

| Mistake | Correct Approach |
|---|---|
| Calling `supabase.getClient()` in a component | Call it in a service method; component calls service |
| Forgetting `takeUntil(this.destroy$)` | Every `.subscribe()` in a component needs teardown |
| Forgetting `this.cdr.markForCheck()` | Call it after every async state update in OnPush components |
| Using `async` pipe in template | Subscribe in component, store in a property, use property in template |
| Missing `trackBy` on `*ngFor` | Always provide a `trackBy` function |
| Querying `movie_suggestions` without `is('deleted_at', null)` | Always filter soft-deleted rows |
| Calling OMDB without checking DB cache | Use `getOrCacheMovie(imdbId)` which checks DB first |
| Calling OMDB on every keystroke | 2500ms debounce + Enter key; use `merge(query$, searchNow$)` |
| Parallel OMDB calls in bulk operations | Use `concatMap` + `delay(200)` |
| Missing `100dvh` + safe area on a new screen | Apply the full `:host` pattern from Section 5 |
| Importing `CommonModule` directly in a feature module | Import `SharedModule` — it re-exports `CommonModule` |
| Using `router.navigate` with a relative path | Always use absolute paths: `['/home']`, `['/suggest']` |
| Adding a route without `canActivate: [authGuard]` | Every new route except `/select-member` and `/admin` must be guarded |
| Hard-coding `movie_cast` as `cast` | The DB column is `movie_cast`; the TS property is `movieCast` |
| Using `100vh` only (no `100dvh`) | Always stack: `height: 100vh; height: 100dvh;` for browser fallback |
| Forgetting `flex-shrink: 0` on topbar | Topbar must not shrink in flex column layouts |

---

*Keep this file updated when new patterns are established or existing patterns change.*
