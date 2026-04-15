import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, merge } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, takeUntil } from 'rxjs/operators';
import { MemberService } from '../core/services/member.service';
import { OmdbService } from '../core/services/omdb.service';
import { SuggestionsService } from './suggestions.service';
import { MovieSearchResult } from './suggestions.types';

@Component({
  selector: 'app-suggest-new',
  templateUrl: './suggest-new.component.html',
  styleUrls: ['./suggest-new.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestNewComponent implements OnInit, OnDestroy {
  query = '';
  results: MovieSearchResult[] = [];
  isSearching = false;
  selected: MovieSearchResult | null = null;
  manualWarnings = '';
  isSubmitting = false;
  submitError: string | null = null;
  submitSuccess = false;

  private readonly destroy$ = new Subject<void>();
  private readonly query$ = new Subject<string>();
  private readonly searchNow$ = new Subject<string>();

  constructor(
    private omdbService: OmdbService,
    private suggestionsService: SuggestionsService,
    private memberService: MemberService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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
            return [];
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
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onQueryChange(value: string): void {
    this.query = value;
    this.selected = null;
    this.submitError = null;
    this.query$.next(value);
  }

  onSearchEnter(): void {
    if (this.query.trim()) {
      this.searchNow$.next(this.query);
    }
  }

  selectMovie(result: MovieSearchResult): void {
    this.selected = result;
    this.results = [];
    this.cdr.markForCheck();
  }

  clearSelection(): void {
    this.selected = null;
    this.results = [];
    this.query = '';
    this.manualWarnings = '';
    this.submitError = null;
    this.cdr.markForCheck();
  }

  get canSubmit(): boolean {
    return !!this.selected && !this.isSubmitting;
  }

  get memberId(): string | null {
    return this.memberService.currentMember?.id ?? null;
  }

  onSubmit(): void {
    if (!this.canSubmit || !this.memberId || !this.selected) return;

    this.isSubmitting = true;
    this.submitError = null;
    this.cdr.markForCheck();

    const warnings = this.manualWarnings
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    const addSuggestion = (movieId: string) => {
      this.suggestionsService
        .addSuggestion(movieId, this.memberId!, warnings)
        .pipe(takeUntil(this.destroy$))
        .subscribe((id) => {
          this.isSubmitting = false;
          if (id) {
            this.submitSuccess = true;
            this.cdr.markForCheck();
            setTimeout(() => this.router.navigate(['/suggest']), 800);
          } else {
            this.submitError = 'Could not add the suggestion. Please try again.';
            this.cdr.markForCheck();
          }
        });
    };

    if (this.selected.inDb && this.selected.id) {
      addSuggestion(this.selected.id);
    } else {
      // Fetch full OMDB detail and cache in DB first
      this.omdbService
        .getOrCacheMovie(this.selected.imdbId)
        .pipe(takeUntil(this.destroy$))
        .subscribe((movieId) => {
          if (!movieId) {
            this.isSubmitting = false;
            this.submitError = 'Could not look up movie details. Check your OMDB API key in Settings.';
            this.cdr.markForCheck();
            return;
          }
          addSuggestion(movieId);
        });
    }
  }

  goBack(): void { this.router.navigate(['/suggest']); }

  trackByImdbId(_: number, r: MovieSearchResult): string { return r.imdbId; }
}
