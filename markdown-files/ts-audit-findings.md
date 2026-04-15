# TypeScript Audit Findings

> Audit performed 2026-04-15. Covers all files under `src/app/**/*.ts` (no test files).

---

## 1. Dead Code

| Finding | File | Action |
|---------|------|--------|
| `rating-input` `mode` values `stars-whole` / `stars-half` declared but never used in UI (comment says stubbed) | `shared/components/rating-input/rating-input.component.ts:23` | Remove dead enum values or complete feature |
| `focusPin()` is public but only called internally | `select-member/select-member.component.ts:126` | Make private |
| `Component` import in stub file with no decorator | `discovery/discovery.component.ts:1` | Remove once feature is built |

---

## 2. Duplication Hotspots

### 2.1 `destroy$` / `takeUntil` boilerplate — 8 components

Every stateful component declares:
```typescript
private readonly destroy$ = new Subject<void>();
ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
```

**Affected:** home, ratings, suggestions, suggest-new, movie-nights, history, stats, profile, bulk-import

**Recommendation:** Create `shared/util/destroy.ts` with a `DestroyComponent` base class:
```typescript
export class DestroyComponent implements OnDestroy {
  protected readonly destroy$ = new Subject<void>();
  ngOnDestroy() { this.destroy$.next(); this.destroy$.complete(); }
}
```

---

### 2.2 `private get client()` try-catch — 9 services

Every service contains:
```typescript
private get client() {
  try { return this.supabase.getClient(); } catch { return null; }
}
```

**Affected:** admin.service, omdb.service, ratings.service, suggestions.service, history.service, movie-nights.service, profile.service, bulk-import.service, stats.service

**Recommendation:** Add `getClientOrNull(): SupabaseClient | null` to `SupabaseService` once — then each service becomes a one-liner.

---

### 2.3 Navigation helpers — 10 components

`goBack()` / `goHome()` / `navigate(path)` re-implemented in every component.

**Recommendation:** `shared/services/navigation.service.ts`:
```typescript
goBack() { this.router.navigate(['/home']); }
goHome() { this.router.navigate(['/home']); }
navigate(path: string) { this.router.navigate([`/${path}`]); }
```

---

### 2.4 `isNonEnglish()` logic — 3 components

Identical language check in `suggestions.component.ts:158`, `movie-nights.component.ts:202`, `history.component.ts:187`.

**Recommendation:** `shared/util/language.ts`:
```typescript
export function isNonEnglish(lang: string | null): boolean {
  if (!lang) return false;
  return !lang.toLowerCase().startsWith('english');
}
```

---

### 2.5 Date parsing — inconsistent across 3+ locations

`YYYY-MM-DD` strings parsed two ways: manual split (`ratings.component.ts:160`, `history.component.ts:204`) vs. direct `new Date(iso)` (`profile.service.ts:275`).

**Recommendation:** `shared/util/date.ts`:
```typescript
export function parseYyyyMmDd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
```

---

### 2.6 Score → color mapping — 3+ locations

`score >= 7.5 → green`, `>= 5.0 → gold`, else red in `history.component.ts:197`, `stats.component.ts:53`, `profile-contrarian.component.ts:14`.

**Recommendation:** `shared/util/score.ts`:
```typescript
export function scoreColor(score: number): string {
  if (score >= 7.5) return '#4a9a5a';
  if (score >= 5.0) return '#d4a03a';
  return '#c04040';
}
```

---

### 2.7 Movie search debounce pipeline — 2 components

Identical `merge(query$.pipe(debounceTime(2500), distinctUntilChanged()), searchNow$).pipe(switchMap(...))` pattern in `suggest-new.component.ts:49` and `movie-nights.component.ts:94`.

---

### 2.8 `trackBy` functions — 9 components, ~14 copies

`trackById`, `trackByMemberId`, `trackByImdbId` re-declared in every component.

**Recommendation:** `shared/util/track-by.ts` with exported functions.

---

## 3. Systemic Issues

### 3.1 ChangeDetectionStrategy — inconsistent

- Most components: `OnPush` + manual `cdr.markForCheck()` — **92 call-sites** across the codebase
- `discovery.component.ts`, `rating-input.component.ts`: no strategy set (defaults to Default CD)
- Profile sub-components (presentational, Input-only): use OnPush unnecessarily

**Path forward:** Either audit and set OnPush consistently everywhere, or migrate stateful containers to signal-based state (Angular 17+) to eliminate most `markForCheck()` calls.

---

### 3.2 Missing `takeUntil` on two subscriptions

- `profile.component.ts` lines 50–76 — `forkJoin(...)` subscribe block has no `takeUntil(destroy$)` → memory leak on route change
- `bulk-import.component.ts` lines 200–210 — subscription inside a callback lacks cleanup

---

### 3.3 Silent error swallowing — 12+ service methods

All `catchError` blocks return empty fallbacks (`of([])`, `of(null)`, `of(false)`) with no logging. Failures are completely invisible in production.

**Recommendation:** At minimum `console.error` in each block. Ideally a `LoggerService` for structured logging / future Sentry integration.

---

### 3.4 Hardcoded magic values

| Value | Location | Suggested constant |
|-------|----------|--------------------|
| 2500ms debounce | suggest-new, movie-nights | `MOVIE_SEARCH_DEBOUNCE_MS` |
| 5000ms undo timeout | `suggestions.component.ts:129` | `UNDO_TIMEOUT_MS` |
| 200ms import delay | `bulk-import.service.ts:162` | `IMPORT_ROW_DELAY_MS` |
| Avatar color list | `admin.service.ts:13` | `AVATAR_COLORS` |
| Preset rating tags | `ratings.component.ts:14` | `RATING_TAGS` |

Should live in `shared/constants/app-config.ts`.

---

## Priority Order

**High impact, low risk — do first:**
1. `SupabaseService.getClientOrNull()` — 9 files, 1-line change each
2. `DestroyComponent` base class — eliminates ~30 lines × 8 components
3. Fix missing `takeUntil` in `profile.component.ts` and `bulk-import.component.ts`
4. `NavigationService` — one shared `goBack`/`goHome`

**Medium impact — do next:**
5. `shared/util/language.ts` — `isNonEnglish`
6. `shared/util/date.ts` — `parseYyyyMmDd`
7. `shared/util/score.ts` — `scoreColor`
8. Add `console.error` to all silent `catchError` blocks

**Nice-to-have:**
9. `shared/util/track-by.ts`
10. `shared/constants/app-config.ts` for magic values
11. Signal-based state to replace OnPush + markForCheck (Angular 17+)
