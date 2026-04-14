import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MemberService } from '../core/services/member.service';
import { RatingsService, PendingRating } from './ratings.service';

export const PRESET_TAGS = [
  'Crowd Pleaser',
  'Hidden Gem',
  'Slow Burn',
  'Emotionally Heavy',
  'Great Cinematography',
  'Rewatch Candidate',
  'Not For Me',
  'Divisive',
];

type RatingStep = 1 | 2 | 3;

@Component({
  selector: 'app-ratings',
  templateUrl: './ratings.component.html',
  styleUrls: ['./ratings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RatingsComponent implements OnInit, OnDestroy {
  step: RatingStep = 1;
  pending: PendingRating | null = null;
  loading = true;
  noPending = false;

  // Form state
  firstWatch: boolean | null = null;
  score: number | null = null;
  reviewNote = '';
  selectedTags = new Set<string>();

  isSubmitting = false;
  submitError: string | null = null;
  submitSuccess = false;

  readonly presetTags = PRESET_TAGS;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private ratingsService: RatingsService,
    private memberService: MemberService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const memberId = this.memberService.currentMember?.id;
    if (!memberId) {
      this.loading = false;
      this.noPending = true;
      this.cdr.markForCheck();
      return;
    }

    this.ratingsService
      .getPendingRating(memberId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((pending) => {
        this.loading = false;
        if (pending) {
          this.pending = pending;
        } else {
          this.noPending = true;
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Step navigation ──────────────────────────────────────────────────────────

  setFirstWatch(value: boolean | null): void {
    this.firstWatch = value;
    this.goToStep(2);
  }

  goToStep(s: RatingStep): void {
    this.step = s;
    this.cdr.markForCheck();
  }

  // ── Score ────────────────────────────────────────────────────────────────────

  onScoreChange(value: number | null): void {
    this.score = value;
    this.cdr.markForCheck();
  }

  get canProceedStep2(): boolean {
    return this.score !== null && this.score >= 0 && this.score <= 10;
  }

  // ── Tags ─────────────────────────────────────────────────────────────────────

  toggleTag(tag: string): void {
    if (this.selectedTags.has(tag)) {
      this.selectedTags.delete(tag);
    } else {
      this.selectedTags.add(tag);
    }
    this.cdr.markForCheck();
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  onSubmit(): void {
    const memberId = this.memberService.currentMember?.id;
    if (!this.pending || !memberId || this.score === null) return;

    this.isSubmitting = true;
    this.submitError = null;
    this.cdr.markForCheck();

    this.ratingsService
      .saveRating({
        movieNightId: this.pending.movieNightId,
        memberId,
        score: this.score,
        firstWatch: this.firstWatch,
        reviewNote: this.reviewNote,
        tags: [...this.selectedTags],
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((success) => {
        this.isSubmitting = false;
        if (success) {
          this.submitSuccess = true;
          this.cdr.markForCheck();
          setTimeout(() => this.router.navigate(['/home']), 1100);
        } else {
          this.submitError = 'Could not save your rating. Please try again.';
          this.cdr.markForCheck();
        }
      });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  get formattedDate(): string {
    if (!this.pending?.date) return '';
    // date is YYYY-MM-DD — parse as UTC to avoid timezone shift
    const [y, m, d] = this.pending.date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  goHome(): void {
    this.router.navigate(['/home']);
  }
}
