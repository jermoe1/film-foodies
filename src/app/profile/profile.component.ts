import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { NavigationService } from '../shared/services/navigation.service';
import { forkJoin } from 'rxjs';
import { MemberService, Member } from '../core/services/member.service';
import { ProfileService } from './profile.service';
import {
  HeaderStats,
  TopItem,
  ContrarianScore,
  MonthlyAvg,
  RatedMovie,
  PendingSuggestion,
} from './profile.types';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  member: Member | null = null;
  isLoading = true;

  headerStats: HeaderStats | null = null;
  genres: TopItem[] = [];
  directors: TopItem[] = [];
  actors: TopItem[] = [];
  contrarian: ContrarianScore | null = null;
  trend: MonthlyAvg[] = [];
  ratings: RatedMovie[] = [];
  suggestions: PendingSuggestion[] = [];

  constructor(
    private nav: NavigationService,
    private memberService: MemberService,
    private profileService: ProfileService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.member = this.memberService.currentMember;
    if (!this.member) {
      this.isLoading = false;
      return;
    }

    const id = this.member.id;

    forkJoin({
      headerStats:  this.profileService.getHeaderStats(id),
      genres:       this.profileService.getTopGenres(id),
      directors:    this.profileService.getTopDirectors(id),
      actors:       this.profileService.getTopActors(id),
      contrarian:   this.profileService.getContrarianScore(id),
      trend:        this.profileService.getRatingTrend(id),
      ratings:      this.profileService.getMyRatings(id),
      suggestions:  this.profileService.getMySuggestions(id),
    }).subscribe({
      next: (data) => {
        this.headerStats = data.headerStats;
        this.genres      = data.genres;
        this.directors   = data.directors;
        this.actors      = data.actors;
        this.contrarian  = data.contrarian;
        this.trend       = data.trend;
        this.ratings     = data.ratings;
        this.suggestions = data.suggestions;
        this.isLoading   = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  goBack(): void { this.nav.goBack(); }
}
