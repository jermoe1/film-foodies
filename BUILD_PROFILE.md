# Build Instructions — My Profile Page

**Module:** `ProfileModule`  
**Route:** `#/profile`  
**Access:** Hamburger menu → My Profile  
**Angular service:** `ProfileService` (reads from Supabase via `ratings`, `movie_nights`, `movie_suggestions`, `members` tables)

---

## Overview

My Profile is a full-screen scrollable page scoped to the currently active member (stored in browser local storage via `MemberService`). It is NOT a global view — every data point shown is specific to the logged-in member. It opens as a standard Angular route navigated to from the hamburger menu drawer.

---

## Visual Design — Cinema Mode Reference

All colors below are Cinema Mode (default dark theme). Use CSS custom properties from `ThemeService` so all six themes work automatically.

| Element | Value |
|---|---|
| Page background | `#0d0d0d` |
| Section dividers | `#1e1e1e` |
| Card backgrounds | `#1a1a1a` |
| Card borders | `#2a2a2a` |
| Primary text | `#f0e0c0` |
| Secondary text | `#6a6a6a` |
| Section label text | `#8a6030` |
| Gold accent | `#d4a03a` |
| Crimson accent | `#c04040` |
| Avatar ring border | `#d4a03a` |
| Avatar background | `#2a1a00` |

---

## Component Structure

```
ProfileModule
├── profile.component.ts / .html / .scss   (page shell, scroll container)
├── profile-header.component.ts            (avatar + name + stat pills)
├── profile-genre-row.component.ts         (top 3 genres card row)
├── profile-director-row.component.ts      (top 3 directors card row)
├── profile-actor-row.component.ts         (top 3 actors card row)
├── profile-contrarian.component.ts        (contrarian score card)
├── profile-trend-chart.component.ts       (rating trend line chart)
├── profile-poster-grid.component.ts       (my ratings poster grid)
└── profile-suggestions.component.ts       (my pending suggestions list)
```

All sub-components are declared in `ProfileModule` only. `RatingInputComponent` from `SharedModule` is NOT used on this page — ratings are display-only here.

---

## Top Bar

```html
<div class="topbar">
  <button class="back-btn" (click)="goBack()">← (chevron svg)</button>
  <h1 class="topbar-title">My Profile</h1>
  <div class="topbar-spacer"></div>
</div>
```

- `goBack()` calls `Location.back()` from `@angular/common`
- Title: "My Profile" in Georgia serif, gold `#d4a03a`, 15px
- Top padding: 44px (accounts for phone status bar area)

---

## Section 1 — Profile Header

**Layout:** Centered column — avatar ring → name → role line → stat pills

### Avatar Ring
- 80×80px circle
- Background: `#2a1a00`
- Border: 3px solid `#d4a03a`
- Content: member's `first_name[0]` initial, 32px Georgia serif, gold `#d4a03a`
- Avatar color comes from `members.avatar_color` in Supabase — use this as the border color, NOT hardcoded gold

### Name
- `members.first_name` — 20px Georgia serif, `#f0e0c0`

### Role / Since Line
- Format: `Admin · Member since [Month Year]` for admin; `Member since [Month Year]` for non-admin
- `members.is_admin` determines prefix
- `members.created_at` formatted as "March 2022"
- 10px, `#6a5030`, 2px letter-spacing, uppercase

### Stat Pills — four pills in a flex row

Fetch all four values in a single `ProfileService.getHeaderStats(memberId)` call:

| Pill | Label | Source |
|---|---|---|
| Total watched | Watched | COUNT of `movie_night_attendees` WHERE `member_id = X AND attended = true` |
| Avg score | Avg Score | AVG of `ratings.score` WHERE `member_id = X` formatted as `##.#` |
| Suggestions | Suggested | COUNT of `movie_suggestions` WHERE `suggested_by = X AND deleted_at IS NULL` |
| Hosted | Hosted | COUNT of `movie_nights` WHERE `host_id = X` |

**Pill styling:**
- Background: `#1a1a1a`, border: 1px solid `#2a2a2a`, border-radius: 20px
- Value: 17px bold `#d4a03a`
- Label: 9px `#666`, uppercase, 1px letter-spacing
- Padding: 7px 14px

---

## Section 2 — Favorite Genres

**Section label:** "Favorite Genres" — 10px bold `#8a6030`, uppercase, 2px letter-spacing  
**"see more" link:** right-aligned, navigates to a filtered Stats view (stub as `routerLink` for now)

### Data Query — `ProfileService.getTopGenres(memberId, limit = 3)`

```sql
SELECT 
  m.genre,
  AVG(r.score) as avg_score,
  COUNT(r.id) as film_count
FROM ratings r
JOIN movie_nights mn ON r.movie_night_id = mn.id
JOIN movies m ON mn.movie_id = m.id
WHERE r.member_id = :memberId
  AND r.score IS NOT NULL
GROUP BY m.genre
ORDER BY avg_score DESC
LIMIT 3
```

Note: OMDB returns genre as a comma-separated string (e.g. "Action, Thriller"). Split on comma and count each genre independently. The genre that appears most frequently AND has the highest average score ranks first. Use `movie_cast` for cast, `movie_language` for language, `release_year` for year (these are the actual column names — see `supabase/schema.sql`).

### Card Layout — 3 cards in a flex row

Each card:
- Background: `#1a1a1a`, border: 1px solid `#2a2a2a`, border-radius: 10px
- Padding: 10px 12px
- Rank: "#1" / "#2" / "#3" — 9px `#5a5a5a`, uppercase, 1px letter-spacing
- Genre name: 12px bold `#e0d0b0`
- Subtext: "avg X.X · Y films" — 9px `#6a6a6a`

---

## Section 3 — Top Directors

Identical layout to Genres. Query:

```sql
SELECT 
  m.director,
  AVG(r.score) as avg_score,
  COUNT(r.id) as film_count
FROM ratings r
JOIN movie_nights mn ON r.movie_night_id = mn.id
JOIN movies m ON mn.movie_id = m.id
WHERE r.member_id = :memberId
  AND r.score IS NOT NULL
  AND m.director IS NOT NULL
GROUP BY m.director
ORDER BY avg_score DESC
LIMIT 3
```

---

## Section 4 — Top Actors

Identical layout to Genres. OMDB returns `movie_cast` as a comma-separated string of actor names. Split, deduplicate, and count appearances across all rated movies for this member.

```sql
SELECT 
  m.movie_cast,
  r.score
FROM ratings r
JOIN movie_nights mn ON r.movie_night_id = mn.id
JOIN movies m ON mn.movie_id = m.id
WHERE r.member_id = :memberId
  AND r.score IS NOT NULL
```

Process in TypeScript: split each `movie_cast` string on `", "`, build a map of actor → [scores], compute avg per actor, return top 3 by avg score. Truncate long names to fit the card (e.g. "Timothée Chalamet" → "Timothée C.").

---

## Section 5 — My Contrarian Score

**Single card, full width.**

### Data Query — `ProfileService.getContrarianScore(memberId)`

```sql
SELECT 
  r.member_id,
  AVG(r.score) as my_avg,
  (SELECT AVG(score) FROM ratings WHERE movie_night_id = r.movie_night_id AND score IS NOT NULL) as group_avg
FROM ratings r
WHERE r.member_id = :memberId
  AND r.score IS NOT NULL
GROUP BY r.member_id
```

Compute `delta = my_avg - overall_group_avg`. Format as `+X.X` or `-X.X`.

### Display Label Logic

| Delta | Label |
|---|---|
| > +1.5 | "The group optimist" |
| +0.5 to +1.5 | "Slightly generous" |
| -0.5 to +0.5 | "Right on average" |
| -0.5 to -1.5 | "Slightly critical" |
| < -1.5 | "The group critic" |

### Card Styling
- Background: `#1a1a1a`, border: 1px solid `#2a2a2a`, border-radius: 10px
- Left icon: 36×36px circle, crimson tint background, warning triangle SVG icon
- Title: 13px bold `#e0d0b0` (the label from table above)
- Subtitle: 10px `#666` — "You rate +X.X above/below group avg"
- Delta value: 16px bold `#c04040` (positive) or `#4070d0` (negative) or `#d4a03a` (near zero)

---

## Section 6 — Rating Trend Chart

**Title:** "Rating Trend" — section label style  
**Chart:** Line chart, avg score per calendar month, last 12 months

### Data Query — `ProfileService.getRatingTrend(memberId)`

```sql
SELECT 
  DATE_TRUNC('month', mn.date) as month,
  AVG(r.score) as avg_score
FROM ratings r
JOIN movie_nights mn ON r.movie_night_id = mn.id
WHERE r.member_id = :memberId
  AND r.score IS NOT NULL
  AND mn.date >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', mn.date)
ORDER BY month ASC
```

### Chart Implementation

Use a lightweight SVG line chart — do NOT import a full chart library (Chart.js etc.) into this module. Draw it manually in the component template using `*ngFor` to plot SVG `<polyline>` points.

**Chart container:** `background: #111`, border: 1px solid `#1e1e1e`, border-radius: 10px, padding: 12px, height: 110px

**SVG specs:**
- ViewBox: `0 0 310 86`
- Y-axis: 0.0–10.0 mapped to 86px height (inverted — 10.0 at top)
- X-axis: months distributed evenly across 310px width
- Grid lines at y=4, y=7, y=10 in `#1e1e1e`
- Line: stroke `#d4a03a`, stroke-width 1.8, `stroke-linecap: round`, `stroke-linejoin: round`
- Fill area under line: gradient from `rgba(212,160,58,0.25)` to transparent
- Data points: 2.5px radius circles, fill `#d4a03a`
- Month labels: 7px `#3a3a3a` below x-axis, abbreviated (Jul, Aug, etc.)
- Y-axis labels: 4, 7, 10 at left edge in `#3a3a3a`
- "avg / month" label: 9px `#444`, top-right corner of chart area

**Empty state:** If fewer than 2 months of data exist, show: "Rate more movies to see your trend" centered in the chart area in `#5a5a5a`.

---

## Section 7 — My Ratings (Poster Grid)

**Layout:** 3-column CSS grid, `gap: 6px`  
**Aspect ratio:** Each cell is 2:3 (portrait poster ratio)  
**"sort" link:** right-aligned — opens a sort bottom sheet (stub for now, options: Recent, Highest, Lowest, A–Z)

### Data Query — `ProfileService.getMyRatings(memberId, limit = 6)`

```sql
SELECT 
  r.score,
  r.first_watch,
  mn.date,
  m.title,
  m.poster_url,
  m.release_year
FROM ratings r
JOIN movie_nights mn ON r.movie_night_id = mn.id
JOIN movies m ON mn.movie_id = m.id
WHERE r.member_id = :memberId
  AND r.score IS NOT NULL
ORDER BY mn.date DESC
LIMIT 6
```

Default shows 6 most recent rated movies. Full list available via "sort" → see all.

### Each Poster Cell

```
[ poster background (gradient or real image if poster_url exists) ]
[ badge: "1st" if first_watch = true, "re" if first_watch = false ]
[ bottom overlay gradient ]
[ left: movie title (7px, #aaa, max 2 lines) ]
[ right: score (13px bold #d4a03a) ]
```

**Poster background:**
- If `poster_url` is not null: `<img>` with `object-fit: cover`, `object-position: top`
- If `poster_url` is null: dark gradient placeholder matching the movie's panel color accent

**"1st" badge** (first_watch = true):
- Top-right, `background: rgba(212,160,58,0.25)`, border: 1px solid `rgba(212,160,58,0.45)`, border-radius: 3px, 7px `#d4a03a`, padding: 1px 4px

**"re" badge** (first_watch = false):
- Same position, `background: rgba(80,80,80,0.3)`, border: 1px solid `rgba(80,80,80,0.4)`, 7px `#888`

**Score display:**
- Group average is NOT shown on the poster
- Group average IS shown in a tap-to-expand detail sheet (stub for now — just show a bottom sheet with movie title, my score, group avg, my note if any)

---

## Section 8 — My Suggestions

**Title:** "My Suggestions" — section label style  
**"see more" link:** navigates to View Suggestions filtered to current member

### Data Query — `ProfileService.getMySuggestions(memberId, limit = 3)`

```sql
SELECT 
  ms.id,
  ms.up_votes,
  ms.down_votes,
  ms.suggested_at,
  m.title,
  m.release_year,
  m.genre,
  m.director,
  m.movie_cast,
  m.poster_url
FROM movie_suggestions ms
JOIN movies m ON ms.movie_id = m.id
WHERE ms.suggested_by = :memberId
  AND ms.deleted_at IS NULL
  AND ms.status = 'pending'
ORDER BY ms.suggested_at DESC
LIMIT 3
```

### Each Suggestion Row

```
[ small poster thumbnail (30×44px) ]
[ movie title (12px bold #e0d0b0) ]
[ meta: "YEAR · GENRE · DIRECTOR" (10px #5a5a5a) ]
[ vote counts: "+X" green / "-X" crimson, right-aligned ]
```

Row styling: background `#1a1a1a`, border `#2a2a2a`, border-radius 8px, padding 10px 12px, flex row with gap 10px.

---

## ProfileService — Full Interface

Create `src/app/profile/profile.service.ts`:

```typescript
@Injectable({ providedIn: ProfileModule })
export class ProfileService {
  getHeaderStats(memberId: string): Observable<HeaderStats>
  getTopGenres(memberId: string, limit?: number): Observable<GenreStat[]>
  getTopDirectors(memberId: string, limit?: number): Observable<DirectorStat[]>
  getTopActors(memberId: string, limit?: number): Observable<ActorStat[]>
  getContrarianScore(memberId: string): Observable<ContrarianScore>
  getRatingTrend(memberId: string): Observable<MonthlyAvg[]>
  getMyRatings(memberId: string, limit?: number): Observable<RatedMovie[]>
  getMySuggestions(memberId: string, limit?: number): Observable<PendingSuggestion[]>
}
```

Each method wraps a Supabase query and returns an Observable. Use `from(supabase.from(...).select(...))` wrapped with `map` to shape the response.

---

## Empty States

The profile page may be seen before the member has any data. Handle each section:

| Section | Empty condition | Message |
|---|---|---|
| Header stats | All zeros on first use | Show zeros — this is fine |
| Genres / Directors / Actors | No ratings yet | "Rate some movies to see your favorites" in muted `#5a5a5a`, centered in the card row area |
| Contrarian Score | Fewer than 3 ratings | "Rate at least 3 movies to see your score" |
| Rating Trend | Fewer than 2 months | "Rate more movies to see your trend" |
| My Ratings grid | No ratings | Empty state card: film reel icon + "No ratings yet — tap Rate on the home screen" + gold CTA button navigating to `#/` |
| My Suggestions | No pending suggestions | "No pending suggestions — tap Suggest on the home screen" in muted text |

---

## Loading State

Show a skeleton loader while data is fetching:
- Avatar circle: pulsing gray circle
- Stat pills: 4 gray rounded rectangles
- Each section card row: 3 gray rectangles at card height
- Use a simple CSS `@keyframes pulse` animation alternating between `#1a1a1a` and `#222`

---

## Navigation

- Accessed via `router.navigate(['/profile'])` from the hamburger menu drawer
- Back button calls `location.back()`
- "see more" on Genres/Directors/Actors: stub `routerLink="/stats"` for now
- "see more" on Suggestions: stub `routerLink="/suggestions"` filtered by member
- "sort" on Ratings: stub — open a bottom sheet component (implement after core profile is done)
- Poster tap: stub — open a bottom sheet showing: poster, title, my score, group avg, my note, first_watch flag

---

## Key Implementation Notes

1. **Column names differ from spec doc** — use `movie_cast` (not `cast`), `movie_language` (not `language`), `release_year` (not `year`), `full_name` (not `name`), `review_note` (not `note`). See `supabase/schema.sql` for authoritative column names.

2. **Active member** is retrieved from `MemberService.getCurrentMember()` which reads from browser local storage. Never hardcode a member ID.

3. **All Supabase calls go through `ProfileService`** — never call `supabase` directly from components.

4. **Theme colors** — import `ThemeService` for color tokens rather than hardcoding hex values in component SCSS. The six themes (Cinema, Lobby, High Contrast, Anti-Glare, Colorblind, Forest) must all render correctly.

5. **Score formatting** — always display scores as `##.#` using `.toFixed(1)`. A score of `8` must display as `8.0`, never `8`.

6. **Genre string splitting** — OMDB genre field is comma-separated (e.g. `"Action, Thriller, Drama"`). Split on `", "` before grouping. A movie with 3 genres counts toward all 3.

7. **Actor string splitting** — OMDB `movie_cast` field is comma-separated names. Split on `", "` and treat each name independently. Take only the first 3–4 actors per film (OMDB sometimes lists many).

8. **Contrarian score delta formatting** — always show sign: `+0.8` not `0.8`. Use `(delta >= 0 ? '+' : '') + delta.toFixed(1)`.

9. **SVG chart** — do not use Chart.js or any external library. Build the chart as an inline Angular SVG template with `*ngFor` to plot points. This keeps the bundle small and eliminates a dependency.

10. **Mobile scroll** — the entire page is one scrollable container. Do not nest scrollable elements. The poster grid and suggestions list must NOT have their own scroll containers.

---

## Visual Reference

The approved mockup shows the following section order (top to bottom):
1. Top bar (back button + "My Profile" title)
2. Profile header (avatar + name + role/since + stat pills)
3. Divider
4. Favorite Genres (3 cards + "see more")
5. Divider
6. Top Directors (3 cards + "see more")
7. Divider
8. Top Actors (3 cards + "see more")
9. Divider
10. My Contrarian Score (single card)
11. Divider
12. Rating Trend (line chart)
13. Divider
14. My Ratings (poster grid + "sort")
15. Divider
16. My Suggestions (list + "see more")
17. Bottom padding (36px)

---

## Related Files

- `src/app/core/member.service.ts` — `getCurrentMember(): Member`
- `src/app/core/theme.service.ts` — theme color tokens
- `src/app/shared/empty-state/empty-state.component.ts` — reusable empty state
- `supabase/schema.sql` — authoritative database schema with correct column names
- `CONTEXT.md` — full project context and architectural decisions
- `SPEC.md` — full project specification v1.5

---

*BUILD_PROFILE.md — Film Foodies · Profile Page Build Instructions*
