# Architecture

> **Persona Discussion**
>
> **Dev:** The existing app uses NgModule architecture — `AppModule`, `CoreModule`, `SharedModule`, plus one module per feature. It works, but Angular 18 has fully committed to standalone components as the preferred pattern. A rebuild is the right time to go standalone — it eliminates the boilerplate of declaring every component in a module, makes lazy loading per-route (not per-module) possible, and aligns with where Angular is heading. The tradeoff is that the SharedModule pattern (re-export common Angular modules) has to be replaced with explicit imports on each component, but that's actually cleaner.
>
> **Dev:** State management is the other big call. Currently it's BehaviorSubjects in services — workable, but verbose. Angular 18 ships with signals, and for this app's scope they're a better fit. `currentMember` is the perfect candidate: it's read by many components, changed rarely, and has a clear owner (MemberService). Replacing the BehaviorSubject with a signal eliminates the async pipe and subscribe/unsubscribe boilerplate in templates.
>
> **QA:** My main concern with the current architecture is silent error swallowing. Services use `catchError` but frequently return `null` or an empty array rather than surfacing the error to the user. In a rebuild, I want a centralized error handling pattern — either an Angular HTTP interceptor-style wrapper around Supabase calls, or at minimum an `ErrorService` that toasts errors rather than silently discarding them.
>
> **DBA:** The profile and stats service methods do a lot of aggregation client-side — fetching all ratings, all nights, all members, then computing averages and deviations in TypeScript. This works today but is a scalability risk. In the rebuild I'd move at least the top genres, top directors, and stats aggregations into Supabase RPC functions. Less data over the wire, faster load times, and the logic lives where the data is.
>
> **Dev:** Agreed. The `forkJoin` in ProfileComponent that fires 8 parallel queries should become 1-2 RPC calls. That'll also clean up the component significantly — right now ProfileComponent is managing a lot of unrelated state.
>
> **UX:** From an architecture standpoint, I care about initial load time. The current lazy-loading per feature module is good — the home page loads fast. In a rebuild, keep lazy loading and consider deferring the stats and profile heavy computations until the user navigates there, not on app init.
>
> **QA:** One more thing: the current codebase has zero unit tests on services, and component tests only exist for AdminComponent. In the rebuild, architecture should account for testability from the start — services should accept an injected Supabase client (not `inject(SupabaseService)` deep inside methods), making them mockable without real DB access.

---

## Tech Stack

| Layer | Current | Rebuild Recommendation |
|-------|---------|----------------------|
| Framework | Angular 18.2, NgModule | Angular 18+ (latest), **standalone components** |
| Language | TypeScript 5.5, strict mode | TypeScript 5.5+, strict mode preserved |
| State | RxJS BehaviorSubjects | **Angular Signals** for shared state; RxJS for async operations |
| Change Detection | OnPush throughout | OnPush throughout (keep) |
| Styling | SCSS, CSS custom properties | SCSS, CSS custom properties (keep, extend) |
| Backend | Supabase (PostgreSQL) | Supabase (keep) |
| Auth | Passcode + SHA-256 + localStorage | Keep — no user accounts needed |
| Testing | Karma + Jasmine (minimal coverage) | **Add service-layer tests** from day one |
| Hosting | GitHub Pages | GitHub Pages (keep) |
| CI/CD | GitHub Actions | GitHub Actions (keep) |
| Router | HashLocationStrategy | HashLocationStrategy (**required** — see constraints.md) |
| External APIs | OMDB, DoesTheDogDie, Claude (stub) | Same — add real Discovery implementation |

---

## Folder Structure (Rebuild)

```
src/
├── app/
│   ├── core/
│   │   ├── guards/
│   │   │   └── auth.guard.ts
│   │   ├── models/                      ← NEW: all interfaces centralized here
│   │   │   ├── member.model.ts
│   │   │   ├── movie.model.ts
│   │   │   ├── rating.model.ts
│   │   │   ├── suggestion.model.ts
│   │   │   ├── movie-night.model.ts
│   │   │   └── index.ts                 ← barrel export
│   │   └── services/
│   │       ├── supabase.service.ts
│   │       ├── auth.service.ts
│   │       ├── member.service.ts
│   │       ├── admin.service.ts
│   │       ├── theme.service.ts
│   │       ├── omdb.service.ts
│   │       ├── content-warning.service.ts
│   │       ├── error.service.ts         ← NEW: centralized error toasting
│   │       └── navigation.service.ts
│   ├── features/
│   │   ├── admin/
│   │   │   └── admin.component.ts       ← standalone
│   │   ├── bulk-import/
│   │   │   ├── bulk-import.component.ts
│   │   │   └── bulk-import.service.ts
│   │   ├── discovery/
│   │   │   ├── discovery.component.ts
│   │   │   └── discovery.service.ts     ← implement real Claude API call
│   │   ├── history/
│   │   │   ├── history.component.ts
│   │   │   └── history.service.ts
│   │   ├── home/
│   │   │   └── home.component.ts
│   │   ├── movie-nights/
│   │   │   ├── movie-nights.component.ts
│   │   │   └── movie-nights.service.ts
│   │   ├── profile/
│   │   │   ├── profile.component.ts
│   │   │   ├── profile.service.ts
│   │   │   └── components/              ← dumb sub-components
│   │   │       ├── profile-header/
│   │   │       ├── profile-trend-chart/
│   │   │       ├── profile-poster-grid/
│   │   │       └── ...
│   │   ├── ratings/
│   │   │   ├── ratings.component.ts
│   │   │   └── ratings.service.ts
│   │   ├── select-member/
│   │   │   └── select-member.component.ts
│   │   ├── stats/
│   │   │   ├── stats.component.ts
│   │   │   └── stats.service.ts
│   │   └── suggestions/
│   │       ├── suggestions.component.ts
│   │       ├── suggest-new.component.ts
│   │       └── suggestions.service.ts
│   ├── shared/
│   │   ├── components/
│   │   │   ├── rating-input/
│   │   │   ├── member-avatar/           ← NEW: reusable avatar chip
│   │   │   ├── score-chip/              ← NEW: score with color coding
│   │   │   ├── warning-badge/           ← NEW: severity badge
│   │   │   └── poster-image/            ← NEW: lazy-loaded poster with fallback
│   │   └── utils/
│   │       ├── date.utils.ts            ← parseLocalDate() lives here
│   │       ├── language.utils.ts        ← isNonEnglish() lives here
│   │       ├── score-color.utils.ts     ← scoreColor() lives here
│   │       └── destroy.base.ts          ← DestroyComponent base class
│   ├── app.component.ts                 ← standalone root
│   ├── app.config.ts                    ← provideRouter, provideHttpClient, etc.
│   └── app.routes.ts                    ← top-level route definitions
├── environments/
│   ├── environment.ts
│   └── environment.prod.ts
├── styles.scss                          ← design tokens, themes
└── main.ts                              ← bootstrapApplication()
```

---

## Module Strategy: Standalone Components

Replace NgModule architecture with Angular standalone components. Each component declares its own imports.

```typescript
// Example: history.component.ts (standalone)
@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MemberAvatarComponent, ScoreChipComponent],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryComponent { ... }
```

**App bootstrap (main.ts):**
```typescript
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(appRoutes, withHashLocation()),   // ← critical: withHashLocation()
    provideHttpClient(),
    ...
  ]
});
```

---

## Routing (Rebuild Pattern)

All routes lazy-loaded per component (not per module). Use `loadComponent` instead of `loadChildren`.

```typescript
// app.routes.ts
export const appRoutes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'select-member', loadComponent: () => import('./features/select-member/...') },
  { path: 'admin', loadComponent: () => import('./features/admin/...') },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'home', loadComponent: () => import('./features/home/...') },
      { path: 'suggest', loadComponent: () => import('./features/suggestions/...') },
      { path: 'suggest/new', loadComponent: () => import('./features/suggestions/suggest-new...') },
      { path: 'movie-night', loadComponent: () => import('./features/movie-nights/...') },
      { path: 'rate', loadComponent: () => import('./features/ratings/...') },
      { path: 'history', loadComponent: () => import('./features/history/...') },
      { path: 'stats', loadComponent: () => import('./features/stats/...') },
      { path: 'profile', loadComponent: () => import('./features/profile/...') },
      { path: 'discover', loadComponent: () => import('./features/discovery/...') },
      { path: 'bulk-import', loadComponent: () => import('./features/bulk-import/...') },
    ]
  },
  { path: '**', redirectTo: 'home' },
];
```

---

## State Management (Rebuild Pattern)

### Signals for shared state (replaces BehaviorSubjects)

```typescript
// member.service.ts
@Injectable({ providedIn: 'root' })
export class MemberService {
  private _currentMember = signal<Member | null>(null);

  readonly currentMember = this._currentMember.asReadonly();
  readonly isAdmin = computed(() => this._currentMember()?.is_admin ?? false);

  selectMember(member: Member): void {
    this._currentMember.set(member);
    localStorage.setItem('ff_current_member_id', member.id);
  }

  clearMember(): void {
    this._currentMember.set(null);
    localStorage.removeItem('ff_current_member_id');
  }
}
```

### RxJS for async operations (keep)
Use RxJS `Observable` for all Supabase queries. Keep `takeUntilDestroyed()` (Angular 16+ built-in, replaces DestroyComponent base class pattern) for cleanup.

```typescript
// In components (replaces destroy$ + takeUntil pattern)
private destroyRef = inject(DestroyRef);

ngOnInit(): void {
  this.service.getHistory()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(data => { ... });
}
```

### Theme state
Keep in `ThemeService` but read initial value from `member_preferences` table (if memberId known) before falling back to localStorage.

---

## Service Layer

### SupabaseService
Unchanged pattern — singleton, manages client instance.

**Key improvement:** Expose `client$: Observable<SupabaseClient>` that emits when the client is configured. Feature services can await this instead of checking `getClientOrNull()`.

### Error Handling (new: ErrorService)
Centralize error surfacing instead of silent nulls:

```typescript
@Injectable({ providedIn: 'root' })
export class ErrorService {
  private _errors = signal<string[]>([]);
  readonly errors = this._errors.asReadonly();

  report(message: string): void {
    this._errors.update(e => [...e, message]);
    setTimeout(() => this._errors.update(e => e.slice(1)), 4000);
  }
}
```

Wire a global toast component in AppComponent that renders `errors()`.

### Profile & Stats — Move Aggregations to RPC

Current problem: ProfileService fires 8 parallel Supabase queries and aggregates client-side.

**Rebuild approach:** Create Supabase RPC functions:
- `get_member_profile_stats(member_id uuid)` → returns `HeaderStats + TopItems + ContrarianScore + trend`
- `get_group_stats()` → returns full `StatsResult`

This reduces ProfileComponent to a single RPC call and eliminates client-side math.

---

## Change Detection Strategy

**Rule:** All components use `ChangeDetectionStrategy.OnPush`.

With signals, template expressions that read signals (`currentMember()`) automatically trigger re-render — no `markForCheck()` needed for signal-driven data. Keep `markForCheck()` only for RxJS subscriptions that update local properties.

---

## Testing Strategy

| Layer | Approach |
|-------|---------|
| Services | `TestBed` with a mock `SupabaseService` (inject a spy/fake) |
| Components | `TestBed` with `NO_ERRORS_SCHEMA` for shallow rendering |
| Utils | Pure function tests (no Angular needed) |
| Integration | Supabase local emulator for RPC function tests |

**Priority test targets (day one):**
- `parseLocalDate()` — catches the UTC date bug
- `AuthService.hashPasscode()` — security-critical
- `OmdbService.searchMovies()` — DB-first logic
- `StatsService.getStats()` — computation logic
- `SuggestionsService.vote()` — optimistic update correctness

---

## Performance Considerations

| Concern | Current | Rebuild Fix |
|---------|---------|------------|
| Stats load | Fetches all nights + ratings client-side | RPC aggregation on server |
| Profile stats | 8 parallel queries | 1–2 RPC calls |
| OMDB search debounce | 2.5s (intentional, preserve) | Keep |
| Image loading | No lazy loading on poster images | Add `loading="lazy"` to all `<img>` |
| Bundle size | ~500kB initial budget | Standalone components reduce dead-code via tree-shaking |
| OnPush CD | Used throughout | Keep; signals make it more effective |

---

## LocalStorage Key Registry

All `localStorage` keys are prefixed `ff_`. Do not rename — existing users' sessions depend on these keys.

| Key | Value | Set By |
|-----|-------|--------|
| `ff_supabase_config` | `{ url, anonKey }` JSON | Admin setup screen |
| `ff_passcode_verified` | `'true'` | AuthService.markAuthenticated() |
| `ff_current_member_id` | UUID string | MemberService.selectMember() |
| `ff_theme` | Theme name string | ThemeService.apply() |
| `ff_omdb_key` | API key string | Admin screen (dev only) |

---

## Dependency Overview

```
AppComponent
  └── ThemeService (init)
  └── SupabaseService (init)
  └── AuthService (check)
  └── MemberService (restore)
  └── ErrorService (display toasts)

Feature Components
  └── inject core services as needed
  └── inject NavigationService for routing
  └── inject feature-specific service

Feature Services
  └── inject SupabaseService (getClient())
  └── inject ErrorService (report errors)

Shared Components
  └── pure @Input/@Output — no service injection
```
