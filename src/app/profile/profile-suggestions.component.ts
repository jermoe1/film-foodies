import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { PendingSuggestion } from './profile.types';

@Component({
  selector: 'app-profile-suggestions',
  templateUrl: './profile-suggestions.component.html',
  styleUrls: ['./profile-suggestions.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileSuggestionsComponent {
  @Input() suggestions: PendingSuggestion[] = [];
  @Input() isLoading = false;

  get hasSuggestions(): boolean {
    return this.suggestions.length > 0;
  }

  metaLine(s: PendingSuggestion): string {
    return [s.releaseYear, s.genre?.split(', ')[0], s.director?.split(', ')[0]]
      .filter(Boolean)
      .join(' · ');
  }

  trackById(_: number, s: PendingSuggestion): string {
    return s.id;
  }
}
