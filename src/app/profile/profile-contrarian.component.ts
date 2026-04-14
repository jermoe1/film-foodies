import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ContrarianScore } from './profile.types';

@Component({
  selector: 'app-profile-contrarian',
  templateUrl: './profile-contrarian.component.html',
  styleUrls: ['./profile-contrarian.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileContrarianComponent {
  @Input() data: ContrarianScore | null = null;
  @Input() isLoading = false;

  get deltaColor(): string {
    if (!this.data) return '#d4a03a';
    if (this.data.delta > 0.5)  return '#c04040';
    if (this.data.delta < -0.5) return '#4070d0';
    return '#d4a03a';
  }

  get subtitle(): string {
    if (!this.data) return '';
    const abs = Math.abs(this.data.delta).toFixed(1);
    if (this.data.delta > 0.5)  return `You rate ${abs} above group average`;
    if (this.data.delta < -0.5) return `You rate ${abs} below group average`;
    return 'You rate right on the group average';
  }
}
