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
import { StatsService, StatsResult, NightStat, MemberAvg, GenreStat } from './stats.service';

@Component({
  selector: 'app-stats',
  templateUrl: './stats.component.html',
  styleUrls: ['./stats.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsComponent implements OnInit, OnDestroy {
  loading = true;
  result: StatsResult | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private statsService: StatsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.statsService
      .getStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        this.result = result;
        this.loading = false;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  // ── Color helpers ────────────────────────────────────────────────────────────

  scoreColor(score: number): string {
    if (score >= 7.5) return '#4a9a5a';
    if (score >= 5.0) return '#d4a03a';
    return '#c04040';
  }

  deltaColor(delta: number): string {
    if (delta > 0) return '#4a9a5a';
    if (delta < 0) return '#c04040';
    return '#888';
  }

  /** Bar width % for member score bars (0–10 scale → 0–100%). */
  barWidth(score: number | null): number {
    return score !== null ? score * 10 : 0;
  }

  /** Bar width % for genre bars relative to most-watched genre. */
  genreBarWidth(count: number, maxCount: number): number {
    return maxCount > 0 ? (count / maxCount) * 100 : 0;
  }

  maxGenreCount(genres: GenreStat[]): number {
    return genres.length ? genres[0].count : 1;
  }

  // ── Track helpers ────────────────────────────────────────────────────────────

  trackByNightId(_: number, item: NightStat): string { return item.nightId; }
  trackByMemberId(_: number, item: MemberAvg): string { return item.memberId; }
  trackByGenre(_: number, item: GenreStat): string { return item.genre; }
  trackByMemberScore(_: number, item: { memberId: string }): string { return item.memberId; }
}
