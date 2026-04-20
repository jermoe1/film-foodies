import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { MemberService } from '../core/services/member.service';
import { RatingsService, PendingRating } from '../ratings/ratings.service';
import { DestroyComponent } from '../shared/util/destroy';
import { NavigationService } from '../shared/services/navigation.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent extends DestroyComponent implements OnInit {
  menuOpen = false;
  pendingRating: PendingRating | null = null;
  rateBarLoaded = false;

  constructor(
    private nav: NavigationService,
    private memberService: MemberService,
    private ratingsService: RatingsService,
    private cdr: ChangeDetectorRef,
  ) { super(); }

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

  navigate(path: string): void {
    this.menuOpen = false;
    this.nav.goTo(path);
  }

  toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }
}
