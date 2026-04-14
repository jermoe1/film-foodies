import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MemberService } from '../core/services/member.service';
import { RatingsService, PendingRating } from '../ratings/ratings.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, OnDestroy {
  menuOpen = false;
  pendingRating: PendingRating | null = null;
  rateBarLoaded = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private memberService: MemberService,
    private ratingsService: RatingsService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const memberId = this.memberService.currentMember?.id;
    if (!memberId) {
      this.rateBarLoaded = true;
      this.cdr.markForCheck();
      return;
    }

    this.ratingsService
      .getPendingRating(memberId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((pending) => {
        this.pendingRating = pending;
        this.rateBarLoaded = true;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  navigate(path: string): void {
    this.menuOpen = false;
    this.router.navigate([`/${path}`]);
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }
}
