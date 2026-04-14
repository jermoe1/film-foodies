import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TopItem } from './profile.types';

@Component({
  selector: 'app-profile-genre-row',
  templateUrl: './profile-genre-row.component.html',
  styleUrls: ['./profile-genre-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileGenreRowComponent {
  @Input() items: TopItem[] = [];
  @Input() isLoading = false;
}
