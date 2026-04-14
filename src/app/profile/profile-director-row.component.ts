import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TopItem } from './profile.types';

@Component({
  selector: 'app-profile-director-row',
  templateUrl: './profile-director-row.component.html',
  styleUrls: ['./profile-director-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileDirectorRowComponent {
  @Input() items: TopItem[] = [];
  @Input() isLoading = false;
}
