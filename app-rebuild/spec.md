# Spec

> **Persona Discussion**
>
> **PO:** The core product purpose is a private, shared app for a small friend group to track their movie nights together. Every feature should be evaluated through that lens — this is never a public app, never individual, always social. The key moments are: suggesting a movie, watching it together, rating it, and looking back at the history.
>
> **User:** The things I actually use: rating after a night, checking the queue before we decide what to watch next, and scrolling history when someone asks "wait, what did we give that movie?" The profile stats are a nice surprise when I visit — I like seeing my top genres. I honestly don't use bulk import, but it was critical for seeding the early history.
>
> **PO:** The features I'd add in a rebuild: (1) actually implement Discovery so it gives real recommendations based on what we've rated; (2) allow photo uploads (not just photo URLs) — the current "photo URL" field is almost never used because no one knows where to upload a photo; (3) a "movie night invite" flow where the host can mark who's coming before the night, not just after.
>
> **UX:** I want to flag three UX improvements: (1) the rating flow has no "skip" option — if a member watched but doesn't want to rate, they're stuck seeing the rate banner forever until they submit something; (2) the suggestions queue has no search/filter by genre or language — once you have 30+ suggestions it gets hard to find specific ones; (3) history cards should show a "who scored what" comparison view without having to expand and look at each person's score individually.
>
> **QA:** Acceptance criteria that are currently implicit and should be made explicit: the 5-second undo on delete must survive a route change (currently it does because the timer lives in the component, but if the component is destroyed the undo is lost — a rebuild should persist undo state in the service, not the component). Also, the "no rating pending" redirect on `/rate` is untested and has no loading state — direct navigation to `/rate` briefly shows a blank form before redirecting.
>
> **Dev:** One important spec clarification: the passcode is optional. If no passcode is configured, the app skips the PIN entry and goes straight to member selection. This means the app can operate in "open mode" for trusted home networks. Document this as a feature, not a bug.
>
> **User:** I love the content warnings — it's really useful to know before we pick a movie that it has graphic violence or animal deaths. The DoesTheDogDie integration is one of the best features even though it's invisible. One improvement: show warnings prominently during movie selection in MovieNightsComponent too, not just in suggestions.

---

## Application Overview

**Film Foodies** is a private, shared web application for a small friend group to track their movie nights together. It is not a public app. There are no individual user accounts — members are identified by selecting their name from a shared list, optionally protected by a group PIN.

**Core loop:**
1. A member **suggests** a movie they want to watch
2. The group **votes** on suggestions to surface the best picks
3. A member **logs a movie night** when a film is watched (date, host, food, attendees)
4. Each attendee **rates** the film after the night
5. Everyone can **browse history**, **view stats**, and see **personal profiles**

---

## Features

### F1 — Authentication & Member Selection

**F1.1 — Passcode Authentication (optional)**
- The group can optionally set a 6-digit numeric PIN
- PIN is SHA-256 hashed and stored in the database
- If no PIN is configured, the app skips passcode entry
- Session is stored in localStorage (`ff_passcode_verified`)

**Acceptance criteria:**
- [ ] 6-digit numeric input; non-numeric characters are ignored
- [ ] Input field is type="password" (shows dots)
- [ ] Auto-submits when 6th digit is entered
- [ ] On wrong passcode: clears input, shows error, re-focuses input
- [ ] On correct passcode: transitions to member picker
- [ ] If no passcode configured: skips directly to member picker
- [ ] Session persists across browser refreshes until explicitly cleared

**F1.2 — Member Selection**
- After passcode (or skipping it), user picks their name from a list
- Selection persists across sessions (`ff_current_member_id`)

**Acceptance criteria:**
- [ ] All members displayed in admin-defined display_order
- [ ] Each member shows first name and avatar color
- [ ] Selecting a member navigates to `/home`
- [ ] Previously selected member is not auto-selected (user must always choose)
- [ ] "Go to Settings" link visible for admin setup access

---

### F2 — Home Dashboard

A hub screen with 3 panels and quick navigation.

**Acceptance criteria:**
- [ ] Three full-bleed panels visible (may require scroll or snap depending on design): Suggest a Movie, Log a Movie Night, View History
- [ ] Each panel is tappable and navigates to the corresponding route
- [ ] Pending-rate banner appears at bottom when current member has an unrated attended movie night
- [ ] Pending-rate banner shows movie title and links to `/rate`
- [ ] Banner is hidden during initial load (no flash of placeholder)
- [ ] Hamburger menu opens a drawer with: Switch Names, My Profile, Discover Movies, View Suggestions, Stats, Bulk Import, Settings
- [ ] Settings menu item only visible to admins
- [ ] App fills full viewport height on iOS Safari (no content cut off by browser UI)

---

### F3 — Suggestions

**F3.1 — View Suggestions Queue**

**Acceptance criteria:**
- [ ] Shows all pending (non-deleted, non-selected) suggestions
- [ ] Each card shows: movie poster, title, year, genre, director, runtime, IMDB rating, language flag for non-English, content warnings badge, up/down vote counts, own vote state
- [ ] Sort options: Oldest, Newest, Top (most upvotes), A–Z
- [ ] Sort preference persists for the session (or as a query param)
- [ ] Voting: tap up/down toggles vote; tapping same direction removes vote
- [ ] Vote changes are optimistic (UI updates immediately)
- [ ] Delete: soft-delete with 5-second undo toast
- [ ] Undo cancels deletion; card reappears in list
- [ ] Undo state is owned by the **service**, not the component — navigating away and back during the 5-second window must still allow the deletion to be cancelled (i.e. `SuggestionsService` holds the pending delete timer, not `SuggestionsComponent`)
- [ ] Sort preference persists via query param so sharing/bookmarking the queue preserves sort
- [ ] Filter by genre: chips or dropdown to show only suggestions matching a genre
- [ ] Filter by language: toggle to show only non-English (or only English) suggestions
- [ ] "Select for Movie Night" navigates to `/movie-night?suggestion=<id>`
- [ ] Empty state shown when queue is empty

**F3.2 — Add a Suggestion**

**Acceptance criteria:**
- [ ] Movie search with 2.5s debounce; Enter key triggers immediate search
- [ ] Search results show: title, year, poster thumbnail
- [ ] Results show DB matches first, supplemented by OMDB if fewer than 3 DB results
- [ ] Selecting a movie shows full detail: poster, title, year, genre, director, runtime, IMDB rating, language, content warnings
- [ ] Content warnings fetched from DoesTheDogDie if API key is configured and warnings not already in DB
- [ ] Manual warnings text field available (newline-separated free text)
- [ ] Submit adds suggestion to queue and navigates back to `/suggest`
- [ ] Cannot suggest a movie already in the queue (prevent duplicates)

---

### F4 — Movie Nights

**F4.1 — Log a Movie Night**

**Acceptance criteria:**
- [ ] Movie search (same DB-first pattern as suggestions)
- [ ] If pre-filled from suggestion (`?suggestion=<id>`), movie is pre-selected and field is locked
- [ ] Date field defaults to today; user can change
- [ ] Host picker defaults to current member; any member can be selected
- [ ] Attendee checkboxes: all members shown, all checked by default; uncheck = absent
- [ ] Food fields: main dish, sides, drinks (all optional text)
- [ ] Advanced section (collapsible): watch platform, cut version, subtitle option, viewing environment (Projector, Large TV checkboxes)
- [ ] Photo upload field (optional): user can upload an image directly (stored in Supabase Storage); falls back to URL input if Storage is not configured
- [ ] Submit creates movie night and navigates to `/history`
- [ ] Content warnings visible on selected movie (not just in suggestions)
- [ ] If movie not yet in DB, it is fetched from OMDB and cached before creating the night
- [ ] If sourced from suggestion, suggestion status is set to 'selected' after creation

**Watch Platform options:** Netflix, Disney+, Max, Hulu, Apple TV+, Prime Video, Blu-Ray, DVD, Projector, Theater, Other

**Cut Version options:** Theatrical, Director's Cut, Extended, Unrated, Other

**Subtitle options:** No subtitles, English subtitles, Subtitles (other language), Dubbed

---

### F5 — Ratings

A 3-step form shown to any member who attended a movie night and hasn't rated it yet.

**Acceptance criteria:**
- [ ] Only shown when member has exactly one unrated attended movie night (most recent)
- [ ] If no pending rating, navigating to `/rate` redirects to `/home`
- [ ] Step 1: "Was this your first time seeing this movie?" — Yes / No (required)
- [ ] Step 2: Score from 0–10 (required; 0.0–10.0, one decimal place)
- [ ] Step 3: Optional tags (multi-select from preset list) + optional review note (textarea)
- [ ] Submitting saves rating and navigates to `/home`
- [ ] "Rate later" button dismisses the pending-rate banner for the current session without submitting a rating; the banner reappears on next app load
- [ ] "Rate later" does not permanently skip — the rating remains pending and the banner returns next session
- [ ] `/rate` shows a loading state while `getPendingRating()` resolves; does not flash a blank form before redirecting
- [ ] Tags available: Laughed out loud, Cried, Great ending, Slow burn, Fell asleep, Would rewatch, Disturbing, Hidden gem

---

### F6 — History

**Acceptance criteria:**
- [ ] All logged movie nights displayed, newest first
- [ ] Each collapsed card shows: date, movie title, poster thumbnail, host name, group average score
- [ ] Expanding a card shows tabs: Details, Trivia, Notes
- [ ] **Details tab:** Full movie info (genre, director, runtime, IMDB rating, language, country, content warnings), food and platform details, attendee list with each member's score, first-watch indicator per member
- [ ] **Trivia tab:** Fun facts for the movie (if any exist); lazy-loaded on first open
- [ ] **Notes tab:** Member notes with author name, timestamp, edited indicator; lazy-loaded on first open; current member can add note; current member can edit/delete their own notes
- [ ] Notes: edit inline (replace note text with input); delete with confirmation
- [ ] Delete movie night: admin-only; inline confirmation required before hard delete
- [ ] Deleted movie night cascades to all related records
- [ ] Non-English films show language flag indicator
- [ ] Average score color-coded: green ≥7.5, gold ≥5.0, red <5.0

---

### F7 — Stats

Group-wide analytics page.

**Acceptance criteria:**
- [ ] Total nights, total members, group average score shown
- [ ] First-watch avg vs. rewatch avg shown separately
- [ ] Per-member average score bar chart, sorted by avg
- [ ] "Split the Room" — top 3 movie nights by score standard deviation (min 3 raters)
- [ ] "Perfect Consensus" — lowest stdDev night (min 3 raters)
- [ ] "Contrarian" — member with highest average deviation from group (min 5 ratings)
- [ ] "Biggest Surprise" — movie with highest positive IMDB delta (actual - IMDB rating)
- [ ] "Most Overhyped" — movie with highest negative IMDB delta
- [ ] "Top Films" — top 5 by group average score (min 2 raters)
- [ ] Genre breakdown — top 8 genres by number of films watched (bar chart)
- [ ] All scores color-coded consistently

---

### F8 — Personal Profile

Per-member profile page.

**Acceptance criteria:**
- [ ] Shows stats for the currently selected member
- [ ] Header: avatar, name, total watched, average score, total suggested, total hosted
- [ ] Top 3 genres by films watched (with average score per genre)
- [ ] Top 3 directors by films watched (with average score per director)
- [ ] Top 3 actors by films watched (with average score per actor)
- [ ] Contrarian score: comparison of member avg vs. group avg on shared nights — labelled descriptively (e.g. "The group optimist", "Right on average")
- [ ] Monthly trend: 12-month sparkline bar chart of average scores
- [ ] Recent ratings: 6-poster grid of most recently rated films with score overlays
- [ ] Pending suggestions: up to 3 of the member's own pending suggestions with vote counts

---

### F9 — Discover Movies *(partial implementation)*

AI-powered movie recommendations. **UI label must always be "Discover Movies" — never "AI".**

**Acceptance criteria:**
- [ ] Displays personalized movie recommendations for the current member
- [ ] Each recommendation shows: poster, title, year, genre, why it's recommended
- [ ] "Add to Suggestions" action on each recommendation
- [ ] Recommendations based on member's rating history and group's history
- [ ] Powered by Claude API via Supabase Edge Function (not called directly from client)
- [ ] No AI branding or AI-related terminology visible anywhere in this UI

---

### F10 — Admin / Settings

**F10.1 — Initial Setup (unguarded `/admin`)**

**Acceptance criteria:**
- [ ] Supabase URL + anon key fields; "Save & Connect" button
- [ ] On save, tests connection and stores to localStorage
- [ ] On success, redirects to `/select-member`
- [ ] Optional OMDB API key field
- [ ] Error shown if connection fails

**F10.2 — In-App Settings (guarded `/settings`, admin-only)**

**Acceptance criteria:**
- [ ] Theme selector: 6 themes (Cinema, Lobby, High Contrast, Anti-Glare, Colorblind, Forest)
- [ ] Theme selection applies immediately and persists
- [ ] Change passcode: 6-digit input; saves new hash; existing sessions remain valid
- [ ] Passcode recovery: if passcode is forgotten, admin can reset it by entering a new one — requires confirming admin status via a secondary mechanism (e.g. re-entering the Supabase anon key, or a one-time recovery code stored in the DB)
- [ ] Add member: first name, full name, avatar color picker (8 options)
- [ ] Rename member: inline edit of first/full name
- [ ] Reorder member: up/down arrows; affects display_order in all member lists
- [ ] App info: OMDB calls made today (vs. 1,000 limit); soft warning shown when approaching 900/1,000

---

### F11 — Bulk Import

For importing historical movie nights from a CSV file.

**Acceptance criteria:**
- [ ] CSV template downloadable (or shown as example)
- [ ] CSV columns: date, title, imdb_id, host, food_main, food_sides, food_drinks, watch_platform, cut_version, photo_url
- [ ] Validation: date format, host matches a known member, title present
- [ ] Preview shows all rows; invalid rows highlighted with error details
- [ ] Enrichment: fetches movie data from OMDB for each valid row (200ms between calls)
- [ ] Progress bar shown during enrichment
- [ ] Final confirmation table before import
- [ ] Import uses Supabase RPC for atomic batch insert
- [ ] Success summary shows count imported vs. errors

---

## Improvement Wishlist (Rebuild Priorities)

These are improvements identified through persona discussion that are not present in the current app:

| # | Feature | Priority | Persona |
|---|---------|----------|---------|
| 1 | Real Discovery implementation (Claude API via Edge Function) | High | PO, User |
| 2 | Photo upload (not just URL field) | High | PO, User |
| 3 | "I'll rate later" skip option in Ratings | Medium | UX, User |
| 4 | Suggestions search/filter by genre or language | Medium | UX, User |
| 5 | Passcode recovery (admin reset flow) | Medium | QA, User |
| 6 | Content warnings visible on MovieNights movie selection | Medium | User |
| 7 | Per-member theme preference stored in DB (follows member across devices) | Low | UX |
| 8 | Stats page member selector (filter stats to subset of members) | Low | PO |
| 9 | "Who scored what" quick-view in collapsed history cards | Low | UX |
| 10 | Soft limit warning when OMDB calls approach 1,000/day | Low | QA |
