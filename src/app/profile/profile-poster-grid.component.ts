import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RatedMovie } from './profile.types';

@Component({
  selector: 'app-profile-poster-grid',
  templateUrl: './profile-poster-grid.component.html',
  styleUrls: ['./profile-poster-grid.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePosterGridComponent {
  @Input() movies: RatedMovie[] = [];
  @Input() isLoading = false;

  get hasMovies(): boolean {
    return this.movies.length > 0;
  }

  trackByTitle(_: number, m: RatedMovie): string {
    return m.title + m.date;
  }
}
