import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MemberService } from '../core/services/member.service';
import { SuggestionsService } from './suggestions.service';
import { SuggestionCard, SortOption } from './suggestions.types';

interface DeletePending {
  id: string;
  movieTitle: string;
}

@Component({
  selector: 'app-suggestions',
  templateUrl: './suggestions.component.html',
  styleUrls: ['./suggestions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuggestionsComponent implements OnInit, OnDestroy {
  cards: SuggestionCard[] = [];
  isLoading = true;
  sort: SortOption = 'oldest';
  deletePending: DeletePending | null = null;
  expandedWarnings = new Set<string>();

  private readonly destroy$ = new Subject<void>();
  private readonly undoCancel$ = new Subject<void>();

  constructor(
    private suggestionsService: SuggestionsService,
    private memberService: MemberService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadQueue();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.undoCancel$.next();
    this.undoCancel$.complete();
  }

  get memberId(): string | null {
    return this.memberService.currentMember?.id ?? null;
  }

  get sortLabel(): string {
    const labels: Record<SortOption, string> = {
      oldest: 'Oldest first',
      newest: 'Newest first',
      top: 'Most upvoted',
      az: 'A – Z',
    };
    return labels[this.sort];
  }

  get hasCards(): boolean { return this.cards.length > 0; }

  readonly sortOptions: { value: SortOption; label: string }[] = [
    { value: 'oldest', label: 'Oldest' },
    { value: 'newest', label: 'Newest' },
    { value: 'top',    label: 'Top Voted' },
    { value: 'az',     label: 'A–Z' },
  ];

  loadQueue(): void {
    this.isLoading = true;
    const memberId = this.memberId ?? '';
    this.suggestionsService
      .getQueue(memberId, this.sort)
      .pipe(takeUntil(this.destroy$))
      .subscribe((cards) => {
        this.cards = cards;
        this.isLoading = false;
        this.cdr.markForCheck();
      });
  }

  setSort(s: SortOption): void {
    if (this.sort === s) return;
    this.sort = s;
    this.loadQueue();
  }

  trackById(_: number, card: SuggestionCard): string { return card.id; }

  goBack(): void { this.router.navigate(['/home']); }
  goSuggest(): void { this.router.navigate(['/suggest/new']); }

  // ── Voting ─────────────────────────────────────────────────────────────────

  onVote(card: SuggestionCard, dir: 'up' | 'down'): void {
    const memberId = this.memberId;
    if (!memberId) return;

    const prevVote = card.myVote;
    const newVote: 'up' | 'down' | null = prevVote === dir ? null : dir;

    // Optimistic update
    if (prevVote === 'up') card.upVotes--;
    if (prevVote === 'down') card.downVotes--;
    if (newVote === 'up') card.upVotes++;
    if (newVote === 'down') card.downVotes++;
    card.myVote = newVote;
    this.cdr.markForCheck();

    this.suggestionsService.vote(card.id, memberId, dir, prevVote).subscribe();
  }

  // ── Soft delete with 5-second undo ────────────────────────────────────────

  onDelete(card: SuggestionCard): void {
    this.undoCancel$.next();
    this.deletePending = { id: card.id, movieTitle: card.movie.title };
    this.cards = this.cards.filter((c) => c.id !== card.id);
    this.cdr.markForCheck();

    timer(5000)
      .pipe(takeUntil(this.undoCancel$), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.deletePending) {
          this.suggestionsService.softDelete(this.deletePending.id).subscribe();
          this.deletePending = null;
          this.cdr.markForCheck();
        }
      });
  }

  onUndoDelete(): void {
    this.undoCancel$.next();
    this.deletePending = null;
    this.loadQueue();
  }

  // ── Select for Movie Night ─────────────────────────────────────────────────

  onSelectForNight(card: SuggestionCard): void {
    this.router.navigate(['/movie-night'], { queryParams: { suggestion: card.id } });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  primaryGenre(card: SuggestionCard): string | null {
    return card.movie.genre?.split(', ')[0] ?? null;
  }

  isNonEnglish(card: SuggestionCard): boolean {
    const lang = card.movie.movieLanguage;
    if (!lang) return false;
    return !lang.toLowerCase().startsWith('english');
  }

  languageLabel(card: SuggestionCard): string {
    return card.movie.movieLanguage?.split(', ')[0] ?? '';
  }

  hasWarnings(card: SuggestionCard): boolean {
    return (card.movie.contentWarnings?.length ?? 0) > 0 || card.manualWarnings.length > 0;
  }

  warningBadgeSeverity(card: SuggestionCard): string {
    const warnings = card.movie.contentWarnings ?? [];
    if (warnings.some((w) => w.severity === 'severe')) return 'severe';
    if (warnings.some((w) => w.severity === 'moderate')) return 'moderate';
    return 'mild';
  }

  toggleWarnings(id: string): void {
    if (this.expandedWarnings.has(id)) {
      this.expandedWarnings.delete(id);
    } else {
      this.expandedWarnings.add(id);
    }
    this.cdr.markForCheck();
  }

  isWarningsExpanded(id: string): boolean {
    return this.expandedWarnings.has(id);
  }

  allWarnings(card: SuggestionCard): { text: string; severity: string; sourceUrl?: string }[] {
    const auto = (card.movie.contentWarnings ?? []).map((w) => ({
      text: w.warning,
      severity: w.severity,
      sourceUrl: w.source_url,
    }));
    const manual = card.manualWarnings.map((w) => ({
      text: w,
      severity: 'manual' as string,
    }));
    return [...auto, ...manual];
  }

  isMySuggestion(card: SuggestionCard): boolean {
    return card.suggestedById === this.memberId;
  }

  relativeDate(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }
}
