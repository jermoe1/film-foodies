# Components

> **Persona Discussion**
>
> **UX:** The three things I want extracted as shared components in the rebuild are: (1) the member avatar chip — it's rendered everywhere (history, stats, profile, suggestions) but each component currently styles it ad-hoc; (2) the score chip with color coding — same situation; (3) the movie poster image with a fallback state when `poster_url` is null. These should be dumb components with clean `@Input` contracts so any feature can use them.
>
> **Dev:** Agreed. I'd also flag DestroyComponent — the base class pattern for managing `destroy$` is fine but in Angular 16+ there's a built-in `DestroyRef` + `takeUntilDestroyed()` that's cleaner and doesn't require inheritance. In the rebuild, remove the base class and inject `DestroyRef` directly in each component.
>
> **QA:** The biggest component-level issue I see is that error states are invisible. Most components show a loading spinner and then silently show nothing if the Supabase call fails. In the rebuild, every smart component should have three template states: loading, error, and content.
>
> **Dev:** `ProfileComponent` is the most bloated smart component — it manages 8 concurrent async results and a lot of display state. In the rebuild it should stay a smart component but delegate heavily to its dumb sub-components. Each sub-component should receive its data as an `@Input` and render it — no logic in sub-components.
>
> **UX:** `HistoryComponent` has a genuinely complex expansion/tab/note-edit interaction model. It needs to be documented carefully so a rebuild doesn't flatten it or lose the lazy-loading behavior on tabs.
>
> **QA:** `RatingsComponent` needs a guard built in: if `getPendingRating()` returns null (member has no pending rating), the component should immediately redirect to `/home` rather than showing a blank form. This edge case is sometimes triggered when a member navigates directly to `/rate`.

---

## Component Inventory

### Notation
- **Smart:** Injects services, manages data fetching and state
- **Dumb:** Pure `@Input`/`@Output`, no service injection, reusable
- **CD:** ChangeDetectionStrategy (all use `OnPush`)

---

## Root

### `AppComponent`
- **Type:** Smart (root)
- **Selector:** `app-root`
- **Template:** `<router-outlet>` only
- **Responsibilities:**
  - On init: restore theme, init Supabase, check auth, restore member from localStorage
  - Render global error toast (new in rebuild — powered by `ErrorService`)
- **Services:** `ThemeService`, `SupabaseService`, `AuthService`, `MemberService`, `Router`
- **Rebuild note:** Add `<app-toast>` component driven by `ErrorService.errors` signal

---

## Unguarded Feature Components

### `SelectMemberComponent`
- **Type:** Smart
- **Route:** `/select-member`
- **CD:** OnPush
- **Views (internal state):** `'checking' | 'passcode' | 'picker'`
- **Template sections:**
  - Checking view: spinner
  - Passcode view: 6-digit hidden input, error message, "Go to Settings" link
  - Picker view: member grid (avatar color + first name per member)
- **Inputs:** None (reads from services)
- **Key behaviors:**
  - Auto-check if passcode is configured on init
  - 6-digit PIN input: type="password", numeric only, auto-submit at 6 chars
  - Wrong passcode: clear input, show error, re-focus input with 150ms delay
  - Member selected: `MemberService.selectMember()` → navigate to `/home`
- **Services:** `AuthService`, `MemberService`, `Router`
- **Edge cases:** If passcode not configured, skip passcode view entirely; if no members exist, show empty state with "Go to Settings" prompt

### `AdminComponent`
- **Type:** Smart
- **Route:** `/admin`
- **CD:** OnPush
- **Template sections:**
  - Supabase config form (URL + anon key inputs + save button)
  - Theme selector (6 theme buttons with visual preview)
  - Passcode section (6-digit input + save)
  - Member list with add, rename inline, and reorder (up/down arrows)
  - App info (OMDB calls today counter)
- **Services:** `SupabaseService`, `AuthService`, `ThemeService`, `AdminService`
- **Rebuild note:** In rebuild, split into `AdminComponent` (first-time setup only: Supabase config) and `SettingsComponent` (in-app: themes, passcode, members). Keeps admin unguarded and settings behind authGuard + adminGuard.

---

## Protected Feature Components

### `HomeComponent`
- **Type:** Smart
- **Route:** `/home`
- **CD:** OnPush
- **Template:**
  - 3 full-bleed panels (scroll-snap or fixed height): Suggest a Movie, Log a Movie Night, View History
  - Each panel: icon, title, subtitle
  - Top-right: hamburger icon → opens bottom sheet drawer
  - Bottom: pending-rate banner (conditionally shown)
- **State:**
  - `menuOpen: boolean`
  - `pendingRating: PendingRating | null`
  - `rateBarLoaded: boolean` (prevents banner flash on load)
- **Services:** `RatingsService`, `MemberService`, `NavigationService`
- **Key behavior:** Fetch pending rating on init; show rate banner only if result exists; hide banner during load to prevent layout shift
- **Rebuild note:** The 3-panel scroll layout needs `height: 100dvh` and `env(safe-area-inset-bottom)` — see constraints.md

---

### `RatingsComponent`
- **Type:** Smart
- **Route:** `/rate`
- **CD:** OnPush
- **Step flow:** Step 1 → Step 2 → Step 3 → submit → navigate to `/home`

**Step 1 — First Watch?**
- Two large buttons: "Yes, first time" / "No, I've seen it"
- Sets `firstWatch: boolean`

**Step 2 — Score**
- Uses `<app-rating-input>` dumb component (0–10 slider/selector)
- Score validation: must be 0–10
- "Next" button enabled only when score is set

**Step 3 — Tags + Review**
- `PRESET_TAGS` grid: 8 toggleable tag chips
- Optional textarea for review note
- "Submit" button → `RatingsService.saveRating()`

- **State:** `pending: PendingRating | null`, `loading: boolean`, `step: 1|2|3`, `firstWatch`, `score`, `selectedTags: Set<string>`, `reviewNote`, `rateLaterDismissed: boolean` (session-only signal)
- **Services:** `RatingsService`, `MemberService`, `NavigationService`
- **Guard behavior:** Shows a loading state while `getPendingRating()` resolves — does not flash a blank form. If result is null, navigates to `/home`.
- **Rate later:** "Rate later" button sets `rateLaterDismissed = true` in sessionStorage and navigates to `/home`. Banner does not reappear for the rest of the session but returns on next app load.

---

### `SuggestionsComponent`
- **Type:** Smart
- **Route:** `/suggest`
- **CD:** OnPush
- **Template:**
  - Sort controls (Oldest / Newest / Top / A–Z)
  - Card list: one `<app-suggestion-card>` per suggestion
  - Empty state when queue is empty
- **State:**
  - `cards: SuggestionCard[]`
  - `sort: 'oldest' | 'newest' | 'top' | 'az'`
  - `deletePending: { id, movieTitle, timerId } | null` — tracks undo window
  - `expandedWarnings: Set<string>` — which cards have warnings expanded
- **Key behaviors:**
  - Vote toggle: optimistic update → service call; if service fails, revert
  - Soft delete: remove card from list → **timer and pending-delete state owned by `SuggestionsService`**, not this component. Component calls `service.startPendingDelete(id)` and `service.undoDelete(id)`. This ensures navigating away and back during the 5-second window still allows undo. `SuggestionsService.softDelete()` is only called when the timer expires inside the service.
  - Select for Night: navigate to `/movie-night?suggestion=<id>`
  - Filter: active genre filter and language filter stored as component signals; applied client-side over the full `cards` array
- **Services:** `SuggestionsService`, `MemberService`, `NavigationService`
- **Helpers (pure, inline):** `primaryGenre(genres: string)`, `isNonEnglish(language: string)`, `warningBadgeSeverity(warnings: ContentWarning[])`, `hasWarnings(card: SuggestionCard)`

---

### `SuggestNewComponent`
- **Type:** Smart
- **Route:** `/suggest/new`
- **CD:** OnPush
- **Template:**
  - Search input (debounced)
  - Results list: movie title, year, poster thumbnail
  - Selected movie detail panel: poster, title, year, genre, director, runtime, IMDB rating, language, content warnings
  - Manual warnings textarea (newline-separated)
  - Submit button
- **State:**
  - `query: string`
  - `results: MovieSearchResult[]`
  - `selected: MovieSearchResult | null`
  - `fetchedWarnings: ContentWarning[]`
  - `manualWarnings: string`
  - `isSearching: boolean`, `isSubmitting: boolean`
- **Search pipeline:**
  - `query$` Subject → debounce 2500ms → `OmdbService.searchMovies()`
  - `searchNow$` Subject → immediate (Enter key) → `OmdbService.searchMovies()`
  - `merge(query$.pipe(debounceTime(2500)), searchNow$)` → switchMap
- **On movie select:**
  - If movie has no content warnings in DB and DTDD API key exists → `ContentWarningService.fetchWarnings(imdbId)` → display
  - If movie in DB already, also call `OmdbService.updateContentWarnings()` to persist fetched warnings
- **On submit:**
  - If movie already in DB: `SuggestionsService.addSuggestion(movieId, memberId, manualWarnings)`
  - If movie not in DB: `OmdbService.getOrCacheMovie(imdbId)` → then `addSuggestion()`
  - Navigate back to `/suggest`
- **Services:** `OmdbService`, `ContentWarningService`, `SuggestionsService`, `MemberService`, `NavigationService`

---

### `MovieNightsComponent`
- **Type:** Smart
- **Route:** `/movie-night`
- **CD:** OnPush
- **Query params read:** `suggestion` (UUID) — pre-fills movie from suggestion
- **Template sections:**
  - Movie search + selection (same pattern as SuggestNew)
  - Date input (default: today, YYYY-MM-DD)
  - Host picker (dropdown, default: currentMember)
  - Attendees: member checkboxes (all checked by default)
  - Food: main, sides, drinks text fields
  - Advanced options (collapsible): watch platform, cut version, subtitle option, viewing environment checkboxes (Projector, Large TV)
  - Photo upload input: file picker that uploads to Supabase Storage and resolves to a URL; falls back to raw URL text input if Storage is not configured
  - Submit button
- **State:**
  - Movie search: `query`, `results`, `selectedMovie`
  - Form: `hostId`, `dateStr`, `food*`, `watchPlatform`, `cutVersion`, `subtitleOption`
  - Attendees: `attendeeChecked: Set<memberId>`
  - Viewing env: `projector: boolean`, `largeTv: boolean`
  - Advanced: `advancedOpen: boolean`
- **On submit flow:**
  1. If movie not in DB: `OmdbService.getOrCacheMovie()` first
  2. `MovieNightsService.createMovieNight(payload)` → returns `nightId`
  3. For each unchecked attendee: `MovieNightsService.updateAttendee(nightId, memberId, false)`
  4. If `suggestion` param present: `MovieNightsService.markSuggestionSelected(suggestionId)`
  5. Navigate to `/history`
- **Constants:**
  - `WATCH_PLATFORMS`: Netflix, Disney+, Max, Hulu, Apple TV+, Prime Video, Blu-Ray, DVD, Projector, Theater, Other
  - `CUT_VERSIONS`: Theatrical, Director's Cut, Extended, Unrated, Other
  - `SUBTITLE_OPTIONS`: No subtitles, English subtitles, Subtitles (other language), Dubbed
- **Services:** `OmdbService`, `MovieNightsService`, `MemberService`, `NavigationService`, `ActivatedRoute`

---

### `HistoryComponent`
- **Type:** Smart
- **Route:** `/history`
- **CD:** OnPush
- **Template:**
  - Reverse-chronological list of `HistoryCard` items (accordion)
  - Each collapsed card: date, movie title, host, avg score, poster thumbnail
  - Expanded card: tabs — Details | Trivia | Notes
    - **Details tab:** Full movie info (genre, director, runtime, IMDB rating, language, country), food details, platform, attendee list with individual scores, content warnings
    - **Trivia tab:** Fun facts list (lazy loaded on first open)
    - **Notes tab:** Notes by members with edit/delete, new note input (lazy loaded on first open)
  - Delete night: inline confirmation (typing or button confirm, then hard delete)
- **State:**
  - `nights: HistoryCard[]`
  - `expandedId: string | null`
  - `activeTab: Map<nightId, 'details' | 'trivia' | 'notes'>`
  - `notesMap: Map<nightId, HistoryNote[]>`
  - `triviaMap: Map<nightId, HistoryFact[]>`
  - `notesLoadingSet: Set<nightId>`
  - `triviaLoadingSet: Set<nightId>`
  - `editingNoteId: string | null`, `editNoteText: string`
  - `deleteConfirmId: string | null`
- **Lazy loading:** Notes and trivia are only fetched on first tab open for that night
- **Services:** `HistoryService`, `MemberService`

---

### `ProfileComponent`
- **Type:** Smart
- **Route:** `/profile`
- **CD:** OnPush
- **Template:** Collection of dumb sub-components, each receiving data as `@Input`
- **Data loaded:** `forkJoin` of all ProfileService calls on init (recommend: replace with 1–2 RPC calls in rebuild)
- **Services:** `ProfileService`, `MemberService`

**Dumb sub-components (all OnPush, all `@Input`-only):**

| Component | Input | Renders |
|-----------|-------|---------|
| `ProfileHeaderComponent` | `stats: HeaderStats`, `member: Member` | Avatar, name, 4 stat counters |
| `ProfileGenreRowComponent` | `items: TopItem[]` | Top 3 genres with bar + avg score |
| `ProfileDirectorRowComponent` | `items: TopItem[]` | Top 3 directors with film count |
| `ProfileActorRowComponent` | `items: TopItem[]` | Top 3 actors with avg score |
| `ProfileContrarianComponent` | `score: ContrarianScore \| null` | Delta label + numeric delta |
| `ProfileTrendChartComponent` | `trend: MonthlyAvg[]` | 12-month sparkline bar chart |
| `ProfilePosterGridComponent` | `ratings: RatedMovie[]` | 6-poster grid with score overlays |
| `ProfileSuggestionsComponent` | `suggestions: PendingSuggestion[]` | Up to 3 pending suggestion cards |

---

### `StatsComponent`
- **Type:** Smart
- **Route:** `/stats`
- **CD:** OnPush
- **Template sections:**
  - Group overview: total nights, members, group avg, first-watch avg, rewatch avg
  - Member averages: bar chart per member
  - Special nights: Split the Room, Perfect Consensus, Biggest Surprise, Most Overhyped
  - Top Films: top 5 by group avg score
  - Genre breakdown: top 8 genres bar chart
  - Contrarian: member with highest avg deviation
- **Helpers (pure, inline):**
  - `scoreColor(score): string` — green/gold/red
  - `deltaColor(delta): string` — green for positive, red for negative
  - `barWidth(value, max): string` — CSS percentage for bar charts
  - `genreBarWidth(count, max): string` — genre bar width
- **Services:** `StatsService`, `MemberService`

---

### `DiscoveryComponent`
- **Type:** Smart (stub — needs implementation)
- **Route:** `/discover`
- **Label:** "Discover Movies" — NEVER "AI" in any user-facing text
- **Intended implementation:**
  - Call `DiscoveryService.getRecommendations(memberId)` → Supabase Edge Function → Claude API
  - Display: recommended movie cards with title, year, poster, explanation of why recommended
  - "Add to Suggestions" action on each card
- **Current status:** Placeholder/stub. No real implementation exists.

---

### `BulkImportComponent`
- **Type:** Smart
- **Route:** `/bulk-import`
- **CD:** OnPush
- **Steps (internal state machine):** `'paste' | 'preview' | 'enriching' | 'ready' | 'importing' | 'done'`

**Step: paste**
- Textarea for CSV input
- Template download link
- "Preview" button

**Step: preview**
- Table of parsed rows with validation errors highlighted in red
- Valid rows shown in green
- "Enrich from OMDB" button (only enabled if ≥1 valid row)

**Step: enriching**
- Progress bar (rows enriched / total valid rows)
- 200ms delay between OMDB calls (rate-limit friendly)

**Step: ready**
- Final table of enriched rows ready for import
- Any rows that failed enrichment shown separately
- "Import" button

**Step: done**
- Success/failure summary
- "Back to Home" link

- **CSV columns:** `date, title, imdb_id, host, food_main, food_sides, food_drinks, watch_platform, cut_version, photo_url`
- **Services:** `BulkImportService`, `MemberService`

---

## Shared / Reusable Components

### `RatingInputComponent` *(existing)*
- **Type:** Dumb
- **Selector:** `app-rating-input`
- **Inputs:** `value: number | null`, `disabled: boolean`
- **Outputs:** `valueChange: EventEmitter<number | null>`
- **Renders:** 0–10 score selector with color feedback (green ≥7.5, gold ≥5, red <5)

---

### `MemberAvatarComponent` *(new in rebuild)*
- **Type:** Dumb
- **Selector:** `app-member-avatar`
- **Inputs:** `member: Pick<Member, 'first_name' | 'avatar_color'>`, `size?: 'sm' | 'md' | 'lg'`
- **Renders:** Colored circle with member initial or first name abbreviation

---

### `ScoreChipComponent` *(new in rebuild)*
- **Type:** Dumb
- **Selector:** `app-score-chip`
- **Inputs:** `score: number | null`, `size?: 'sm' | 'md'`
- **Renders:** Score number with background color: green (≥7.5), gold (≥5), red (<5), gray (null)

---

### `WarningBadgeComponent` *(new in rebuild)*
- **Type:** Dumb
- **Selector:** `app-warning-badge`
- **Inputs:** `warnings: ContentWarning[]`, `expanded: boolean`
- **Outputs:** `expandedChange: EventEmitter<boolean>`
- **Renders:** Badge showing highest severity level; expands to show full warning list

---

### `PosterImageComponent` *(new in rebuild)*
- **Type:** Dumb
- **Selector:** `app-poster-image`
- **Inputs:** `posterUrl: string | null`, `title: string`, `size?: 'sm' | 'md' | 'lg'`
- **Renders:** Movie poster `<img>` with `loading="lazy"`, or a styled fallback placeholder with movie title initial if `posterUrl` is null

---

## Component Patterns (Standards for Rebuild)

### Loading / Error / Content states
Every smart component that fetches data must implement all three states:
```html
@if (loading()) {
  <app-spinner />
} @else if (error()) {
  <p class="error-state">{{ error() }}</p>
} @else {
  <!-- content -->
}
```

### Cleanup
Replace `DestroyComponent` base class with `DestroyRef`:
```typescript
private destroyRef = inject(DestroyRef);

ngOnInit(): void {
  this.service.getData()
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe(data => { ... });
}
```

### Signal-driven state
For shared state (currentMember, theme), read from signals in templates:
```html
<span>{{ memberService.currentMember()?.first_name }}</span>
```
No async pipe needed. Change detection fires automatically on signal change.

### Dumb component contract
- No service injection
- All data via `@Input()`
- All actions via `@Output()`
- Self-contained SCSS with no global class dependencies

---

## Component Dependency Map

```
AppComponent
  ├── ToastComponent (new — driven by ErrorService.errors signal)
  └── <router-outlet>
        ├── SelectMemberComponent
        ├── AdminComponent
        ├── HomeComponent
        ├── RatingsComponent
        │     └── RatingInputComponent
        ├── SuggestionsComponent
        │     ├── MemberAvatarComponent
        │     ├── ScoreChipComponent
        │     └── WarningBadgeComponent
        ├── SuggestNewComponent
        │     ├── PosterImageComponent
        │     └── WarningBadgeComponent
        ├── MovieNightsComponent
        │     ├── PosterImageComponent
        │     └── MemberAvatarComponent
        ├── HistoryComponent
        │     ├── MemberAvatarComponent
        │     ├── ScoreChipComponent
        │     ├── WarningBadgeComponent
        │     └── PosterImageComponent
        ├── ProfileComponent
        │     ├── ProfileHeaderComponent
        │     │     └── MemberAvatarComponent
        │     ├── ProfileGenreRowComponent
        │     ├── ProfileDirectorRowComponent
        │     ├── ProfileActorRowComponent
        │     ├── ProfileContrarianComponent
        │     ├── ProfileTrendChartComponent
        │     ├── ProfilePosterGridComponent
        │     │     └── PosterImageComponent
        │     └── ProfileSuggestionsComponent
        ├── StatsComponent
        │     ├── MemberAvatarComponent
        │     ├── ScoreChipComponent
        │     └── PosterImageComponent
        ├── DiscoveryComponent
        ├── BulkImportComponent
        └── SettingsComponent (new)
```
