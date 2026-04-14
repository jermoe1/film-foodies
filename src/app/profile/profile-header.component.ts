import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Member } from '../core/services/member.service';
import { HeaderStats } from './profile.types';

@Component({
  selector: 'app-profile-header',
  templateUrl: './profile-header.component.html',
  styleUrls: ['./profile-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileHeaderComponent {
  @Input() member: Member | null = null;
  @Input() stats: HeaderStats | null = null;
  @Input() isLoading = false;

  get initial(): string {
    return this.member?.first_name?.[0]?.toUpperCase() ?? '?';
  }

  get avatarColor(): string {
    return this.member?.avatar_color ?? '#C8860A';
  }

  get roleSince(): string {
    if (!this.member) return '';
    const since = new Date(this.member.created_at).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
    return this.member.is_admin ? `Admin · Member since ${since}` : `Member since ${since}`;
  }
}
