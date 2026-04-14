import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TopItem } from './profile.types';

@Component({
  selector: 'app-profile-actor-row',
  templateUrl: './profile-actor-row.component.html',
  styleUrls: ['./profile-actor-row.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileActorRowComponent {
  @Input() items: TopItem[] = [];
  @Input() isLoading = false;
}
