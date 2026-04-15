import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, forkJoin, of, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { MemberService, Member } from '../core/services/member.service';
import { OmdbService } from '../core/services/omdb.service';
import { MovieNightsService, MovieNightPayload } from './movie-nights.service';
import { MovieSearchResult } from '../suggestions/suggestions.types';

export const WATCH_PLATFORMS = [
  'Netflix', 'Hulu', 'Max', 'Disney+', 'Amazon Prime Video',
  'Apple TV+', 'Peacock', 'Paramount+', 'Tubi', 'Plex',
  'YouTube', 'DVD / Blu-ray', 'Digital Rental', 'Digital Purchase',
  'In Theaters', 'Library / Other',
];

export const CUT_VERSIONS = [
  'Standard', "Director's Cut", 'Extended Cut', 'Theatrical Cut',
];

export const SUBTITLE_OPTIONS = [
  'Original Subtitles', 'English Subtitles', 'English Dubbed',
];

@Component({
  selector: 'app-movie-nights',
  templateUrl: './movie-nights.component.html',
  styleUrls: ['./movie-nights.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MovieNightsComponent implements OnInit, OnDestroy {
  // Movie search
  query = '';
  results: MovieSearchResult[] = [];
  isSearching = false;
  selectedMovie: MovieSearchResult | null = null;

  // Form fields
  members: Member[] = [];
  hostId = '';
  dateStr = this.todayStr();
  foodMain = '';
  foodSides = '';
  foodDrinks = '';
  photoUrl = '';

  // Attendees: Set of member IDs that ARE attending
  attendeeChecked = new Set<string>();

  // Advanced options
  advancedOpen = false;
  watchPlatform = '';
  cutVersion = 'Standard';
  subtitleOption = '';
  projector = false;
  largeTv = false;

  // Component state
  loading = true;
  isSubmitting = false;
  submitError: string | null = null;
  submitSuccess = false;

  // Pre-fill from suggestion
  suggestionId: string | null = null;

  readonly platforms = WATCH_PLATFORMS;
  readonly cutVersions = CUT_VERSIONS;
  readonly subtitleOptions = SUBTITLE_OPTIONS;

  private readonly destroy$ = new Subject<void>();
  private readonly query$ = new Subject<string>();
  private readonly searchNow$ = new Subject<string>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private memberService: MemberService,
    private omdbService: OmdbService,
    private movieNightsService: MovieNightsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Set up movie search pipeline:
    // - query$ fires after 2500ms of inactivity (debounce)
    // - searchNow$ fires immediately on Enter key
    merge(
      this.query$.pipe(debounceTime(2500), distinctUntilChanged()),
      this.searchNow$
    )
      .pipe(
        switchMap((q) => {
          if (!q.trim()) {
            this.results = [];
            this.isSearching = false;
            this.cdr.markForCheck();
            return of([]);
          }
          this.isSearching = true;
          this.cdr.markForCheck();
          return this.omdbService.searchMovies(q);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        this.results = results ?? [];
        this.isSearching = false;
        this.cdr.markForCheck();
      });

    // Default host to current member
    const current = this.memberService.currentMember;
    if (current) this.hostId = current.id;

    // Load members, then check for ?suggestion= query param
    this.memberService.getAllMembers()
      .pipe(takeUntil(this.destroy$))
      .subscribe((members) => {
        this.members = members;
        this.attendeeChecked = new Set(members.map((m) => m.id));
        this.loading = false;
        this.cdr.markForCheck();

        const suggId = this.route.snapshot.queryParamMap.get('suggestion');
        if (suggId) {
          this.suggestionId = suggId;
          this.movieNightsService
            .getSuggestionMovie(suggId)
            .pipe(takeUntil(this.destroy$))
            .subscribe((result) => {
              if (result) {
                this.selectedMovie = result.movie;
                this.query = result.movie.title;
              }
              this.cdr.markForCheck();
            });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Movie search ─────────────────────────────────────────────────────────────

  onQueryChange(value: string): void {
    this.query = value;
    this.selectedMovie = null;
    this.submitError = null;
    this.query$.next(value);
  }

  onSearchEnter(): void {
    if (this.query.trim()) {
      this.searchNow$.next(this.query);
    }
  }

  selectMovie(result: MovieSearchResult): void {
    this.selectedMovie = result;
    this.results = [];
    this.query = result.title;
    this.cdr.markForCheck();
  }

  clearMovieSelection(): void {
    this.selectedMovie = null;
    this.results = [];
    this.query = '';
    this.suggestionId = null;
    this.cdr.markForCheck();
  }

  // ── Attendees ────────────────────────────────────────────────────────────────

  toggleAttendee(memberId: string): void {
    if (this.attendeeChecked.has(memberId)) {
      this.attendeeChecked.delete(memberId);
    } else {
      this.attendeeChecked.add(memberId);
    }
    this.cdr.markForCheck();
  }

  // ── Advanced options ─────────────────────────────────────────────────────────

  toggleAdvanced(): void {
    this.advancedOpen = !this.advancedOpen;
    this.cdr.markForCheck();
  }

  /** Show subtitle option only for non-English films. */
  get isNonEnglish(): boolean {
    const lang = this.selectedMovie?.movieLanguage;
    if (!lang) return false;
    const lower = lang.toLowerCase();
    return !lower.startsWith('english') || lower.includes(',');
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  get canSubmit(): boolean {
    return !!this.selectedMovie && !!this.hostId && !!this.dateStr && !this.isSubmitting;
  }

  get currentMemberId(): string | null {
    return this.memberService.currentMember?.id ?? null;
  }

  onSubmit(): void {
    if (!this.canSubmit || !this.selectedMovie || !this.currentMemberId) return;

    this.isSubmitting = true;
    this.submitError = null;
    this.cdr.markForCheck();

    const doCreate = (movieId: string) => {
      const viewingEnv: string[] = [];
      if (this.projector) viewingEnv.push('Projector');
      if (this.largeTv) viewingEnv.push('Large TV');

      const payload: MovieNightPayload = {
        movieId,
        suggestionId: this.suggestionId,
        hostId: this.hostId,
        date: this.dateStr,
        foodMain: this.foodMain,
        foodSides: this.foodSides,
        foodDrinks: this.foodDrinks,
        watchPlatform: this.watchPlatform,
        cutVersion: this.cutVersion || 'Standard',
        subtitleOption: this.isNonEnglish ? this.subtitleOption : '',
        viewingEnvironment: viewingEnv,
        photoUrl: this.photoUrl,
        createdBy: this.currentMemberId!,
      };

      this.movieNightsService.createMovieNight(payload)
        .pipe(takeUntil(this.destroy$))
        .subscribe((movieNightId) => {
          if (!movieNightId) {
            this.isSubmitting = false;
            this.submitError = 'Could not save the movie night. Please try again.';
            this.cdr.markForCheck();
            return;
          }

          // Update any unchecked attendees (trigger already inserted all as attended=true)
          const uncheckedIds = this.members
            .map((m) => m.id)
            .filter((id) => !this.attendeeChecked.has(id));

          const attendeeUpdates$ = uncheckedIds.length
            ? forkJoin(
                uncheckedIds.map((id) =>
                  this.movieNightsService.updateAttendee(movieNightId, id, false)
                )
              )
            : of([]);

          // Mark suggestion as selected if this night came from a suggestion
          if (this.suggestionId) {
            this.movieNightsService
              .markSuggestionSelected(this.suggestionId)
              .pipe(takeUntil(this.destroy$))
              .subscribe();
          }

          attendeeUpdates$.pipe(takeUntil(this.destroy$)).subscribe(() => {
            this.isSubmitting = false;
            this.submitSuccess = true;
            this.cdr.markForCheck();
            setTimeout(() => this.router.navigate(['/home']), 900);
          });
        });
    };

    if (this.selectedMovie.inDb && this.selectedMovie.id) {
      doCreate(this.selectedMovie.id);
    } else {
      // OMDB-only result — cache in DB first
      this.omdbService
        .getOrCacheMovie(this.selectedMovie.imdbId)
        .pipe(takeUntil(this.destroy$))
        .subscribe((movieId) => {
          if (!movieId) {
            this.isSubmitting = false;
            this.submitError =
              'Could not look up movie details. Check your OMDB API key in Settings.';
            this.cdr.markForCheck();
            return;
          }
          doCreate(movieId);
        });
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private todayStr(): string {
    const d = new Date();
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  trackByMemberId(_: number, m: Member): string { return m.id; }
  trackByImdbId(_: number, r: MovieSearchResult): string { return r.imdbId; }
}
