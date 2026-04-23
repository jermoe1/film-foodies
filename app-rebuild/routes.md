# Routes

> **Persona Discussion**
>
> **UX:** The current route structure is clean but there's a UX gap: `/admin` is completely separate from the in-app settings. An admin who's already logged in has to navigate out of the app to change member names or themes. In the rebuild I'd add a `/settings` route that's accessible from within the app (guarded, admin-only) and keep `/admin` as the initial-setup-only unguarded route for Supabase config and first-time passcode.
>
> **PO:** The `/discover` route is a stub right now. It needs to be planned for and documented as a real route with real data dependencies — a Claude API call via Supabase Edge Function. Even if the implementation comes later, the route contract should be defined now.
>
> **Dev:** One thing that trips up contributors: the `authGuard` checks `isAuthenticated` from localStorage, but there's no guard that checks whether Supabase is actually configured. If someone lands on `/home` with a stale `ff_passcode_verified` flag but no Supabase config, they get a blank screen. A `supabaseConfigured` guard should wrap the auth guard and redirect to `/admin` if the client isn't ready.
>
> **QA:** The wildcard route (`**` → redirect to `home`) is fine but means a mistyped URL silently redirects rather than showing a 404. That's acceptable for this app size, but worth noting.
>
> **UX:** Query params are under-documented. `/movie-night?suggestion=<id>` pre-fills the form from a suggestion. This needs to be explicit in the route docs so a rebuild dev doesn't omit it.

---

## Route Table

All routes use `HashLocationStrategy`. URLs appear as `/#/path` in the browser.

| Path | Guard(s) | Component | Module/Load | Purpose |
|------|----------|-----------|-------------|---------|
| `/` | — | — | redirect | Redirects to `/home` |
| `/select-member` | — | `SelectMemberComponent` | lazy | Passcode entry + member picker |
| `/admin` | — | `AdminComponent` | lazy | Initial setup: Supabase config, passcode, themes, members |
| `/home` | authGuard | `HomeComponent` | lazy | Main dashboard |
| `/suggest` | authGuard | `SuggestionsComponent` | lazy | Suggestions queue |
| `/suggest/new` | authGuard | `SuggestNewComponent` | lazy | Add a new suggestion |
| `/movie-night` | authGuard | `MovieNightsComponent` | lazy | Log a new movie night |
| `/rate` | authGuard | `RatingsComponent` | lazy | Rate a pending movie |
| `/history` | authGuard | `HistoryComponent` | lazy | Browse past movie nights |
| `/stats` | authGuard | `StatsComponent` | lazy | Group-wide analytics |
| `/profile` | authGuard | `ProfileComponent` | lazy | Per-member personal stats |
| `/discover` | authGuard | `DiscoveryComponent` | lazy | Movie recommendations (AI-powered, never labelled "AI") |
| `/bulk-import` | authGuard | `BulkImportComponent` | lazy | CSV import of historical movie nights |
| `/settings` | authGuard + adminGuard | `SettingsComponent` | lazy | **NEW** In-app settings: members, themes, passcode |
| `/**` | — | — | redirect | Wildcard → `/home` |

---

## Guard Definitions

### `authGuard` (functional guard)
- **Checks:** `AuthService.isAuthenticated` (localStorage flag `ff_passcode_verified === 'true'`)
- **Also checks:** `SupabaseService.isConfigured` — redirects to `/admin` if Supabase is not set up
- **On fail:** Redirects to `/select-member`
- **Applied to:** All guarded routes

```typescript
export const authGuard: CanActivateFn = () => {
  const supabase = inject(SupabaseService);
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!supabase.isConfigured) return router.createUrlTree(['/admin']);
  if (!auth.isAuthenticated) return router.createUrlTree(['/select-member']);
  return true;
};
```

### `adminGuard` (functional guard — new in rebuild)
- **Checks:** `MemberService.isAdmin`
- **On fail:** Redirects to `/home`
- **Applied to:** `/settings` route

```typescript
export const adminGuard: CanActivateFn = () => {
  const member = inject(MemberService);
  const router = inject(Router);
  return member.isAdmin ? true : router.createUrlTree(['/home']);
};
```

---

## Route Details

### `/select-member`
- **Guard:** None (intentionally unguarded — entry point after passcode)
- **Component:** `SelectMemberComponent`
- **Views within component:**
  - `checking` — resolving whether passcode is required
  - `passcode` — 6-digit PIN entry
  - `picker` — member selection grid
- **On success:** Navigate to `/home`
- **Data dependencies:** `AuthService.hasPasscode()`, `MemberService.getAllMembers()`

---

### `/admin`
- **Guard:** None (intentionally unguarded — needed for first-time setup before any auth exists)
- **Component:** `AdminComponent`
- **Sections:**
  - Supabase config (URL + anon key input)
  - Theme selector
  - Passcode setup (6-digit)
  - Member management (add, rename, reorder)
  - App info (OMDB call count)
- **Data dependencies:** `SupabaseService`, `AdminService`, `ThemeService`, `AuthService`

---

### `/home`
- **Guard:** `authGuard`
- **Component:** `HomeComponent`
- **Layout:** 3 full-bleed panels (Suggest a Movie, Log a Movie Night, View History) + hamburger menu + pending-rate banner
- **Hamburger menu destinations:** Switch Names (`/select-member`), My Profile (`/profile`), Discover Movies (`/discover`), View Suggestions (`/suggest`), Stats (`/stats`), Bulk Import (`/bulk-import`), Settings (`/settings`)
- **Data dependencies:** `RatingsService.getPendingRating(memberId)` — to show/hide rate banner

---

### `/suggest`
- **Guard:** `authGuard`
- **Component:** `SuggestionsComponent`
- **Query params:** `sort` — optional, values: `oldest | newest | top | az` (default: `oldest`)
- **Features:** Sort, vote (up/down), soft-delete with 5-second undo, select for movie night
- **Data dependencies:** `SuggestionsService.getQueue(memberId, sort)`
- **Navigation out:** `/suggest/new` (add button), `/movie-night?suggestion=<id>` (select action)

---

### `/suggest/new`
- **Guard:** `authGuard`
- **Component:** `SuggestNewComponent`
- **Features:** Movie search (DB-first, OMDB supplement), content warning display, manual warning entry, submit suggestion
- **Search behavior:** 2.5s debounce on input, immediate on Enter key
- **Data dependencies:** `OmdbService.searchMovies()`, `ContentWarningService.fetchWarnings()`, `SuggestionsService.addSuggestion()`
- **Navigation out:** Back to `/suggest` on success

---

### `/movie-night`
- **Guard:** `authGuard`
- **Component:** `MovieNightsComponent`
- **Query params:**
  - `suggestion` — optional UUID; if present, pre-fills movie from that suggestion
- **Features:** Movie search, attendee checkboxes, host picker, date picker, food fields, advanced options (platform, cut, subtitles, viewing environment), photo URL
- **Data dependencies:** `OmdbService.searchMovies()`, `MemberService.getAllMembers()`, `MovieNightsService`
- **On success:** Navigates to `/history`
- **Side effects:**
  - Calls `MovieNightsService.markSuggestionSelected(suggestionId)` if `suggestion` param was present
  - Calls `MovieNightsService.updateAttendee(...)` for each unchecked member

---

### `/rate`
- **Guard:** `authGuard`
- **Component:** `RatingsComponent`
- **Features:** 3-step form — (1) first watch?, (2) score 0–10, (3) tags + review note
- **Data dependencies:** `RatingsService.getPendingRating(memberId)` — must exist, else redirect to `/home`
- **Step flow:** firstWatch → score → tags/review → submit → `/home`
- **Data dependencies:** `RatingsService.saveRating(payload)`

---

### `/history`
- **Guard:** `authGuard`
- **Component:** `HistoryComponent`
- **Features:**
  - Accordion cards (one per movie night), newest first
  - Tabs within expanded card: Details | Trivia | Notes
  - Notes: add, edit, delete (with inline edit form)
  - Delete movie night (hard delete, with inline confirmation)
  - Trivia and Notes loaded lazily on first tab open
- **Data dependencies:**
  - `HistoryService.getHistory()` — all nights on load
  - `HistoryService.getNotes(nightId)` — lazy, on Notes tab open
  - `HistoryService.getFacts(movieId)` — lazy, on Trivia tab open

---

### `/stats`
- **Guard:** `authGuard`
- **Component:** `StatsComponent`
- **Features:** Group stats dashboard — member averages, Split the Room nights, consensus pick, contrarian member, biggest surprise, most overhyped, top films, genre breakdown
- **Data dependencies:** `StatsService.getStats()` (single call, all computation in service)

---

### `/profile`
- **Guard:** `authGuard`
- **Component:** `ProfileComponent`
- **Features:** Personal stats — watch count, avg score, hosted count, suggested count, top genres/directors/actors, contrarian score, monthly trend chart, recent ratings grid, pending suggestions
- **Data dependencies:** Multiple `ProfileService` calls (see architecture.md — recommend consolidating to 1 RPC in rebuild)

---

### `/discover`
- **Guard:** `authGuard`
- **Component:** `DiscoveryComponent`
- **Label:** "Discover Movies" — **never "AI"** (see constraints.md)
- **Status:** Stub in current codebase. Rebuild should implement.
- **Intended behavior:** Call Supabase Edge Function which calls Claude API with member's rating history → returns curated recommendations with explanations
- **Data dependencies:** `DiscoveryService.getRecommendations(memberId)` — new service needed

---

### `/bulk-import`
- **Guard:** `authGuard`
- **Component:** `BulkImportComponent`
- **Features:** Paste CSV text → preview/validate rows → enrich from OMDB (progress bar) → import via RPC
- **CSV format:** `date, title, imdb_id, host, food_main, food_sides, food_drinks, watch_platform, cut_version, photo_url`
- **Data dependencies:** `BulkImportService.parseAndValidate()`, `BulkImportService.enrichRows()`, `BulkImportService.importNights()`

---

### `/settings` *(new in rebuild)*
- **Guard:** `authGuard` + `adminGuard`
- **Component:** `SettingsComponent` (new)
- **Purpose:** In-app settings for authenticated admins — replaces the need to visit `/admin` post-setup
- **Sections:** Theme selector, passcode change, member management (add/rename/reorder)
- **Difference from `/admin`:** `/settings` requires auth; `/admin` is unguarded for initial setup
- **Data dependencies:** Same as `AdminComponent` (share the same services)

---

## Navigation Patterns

### Primary navigation
From `HomeComponent` hamburger menu (bottom sheet drawer):
- Tapping menu item → `NavigationService.goTo(path)`
- "Switch Names" → `/select-member` (clears member session, allows re-selection)
- "Settings" → `/settings` (admin only — hide menu item if not admin)

### Back navigation
- Most feature screens: back arrow → `NavigationService.goBack()` (uses Location.back())
- On fresh app load (no history stack), back → falls through to browser default

### Deep links
- `/movie-night?suggestion=<id>` — from Suggestions queue "Select for Movie Night" action
- All links are `/#/` prefixed due to HashLocationStrategy

---

## Route Flow Diagram

```
[First launch, no Supabase config]
  → /admin (configure Supabase URL + anon key)
  → /select-member

[Has config, not authenticated]
  → authGuard → /select-member
  → enter passcode (or skip if no passcode set)
  → pick member
  → /home

[Authenticated]
  /home
    ├── [rate banner] → /rate → /home
    ├── [panel: Suggest] → /suggest
    │     └── [add] → /suggest/new → /suggest
    ├── [panel: Movie Night] → /movie-night → /history
    ├── [panel: History] → /history
    └── [menu]
          ├── Switch Names → /select-member
          ├── My Profile → /profile
          ├── Discover Movies → /discover
          ├── View Suggestions → /suggest
          ├── Stats → /stats
          ├── Bulk Import → /bulk-import
          └── Settings (admin) → /settings
```
