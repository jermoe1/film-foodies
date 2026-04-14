import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { ProfileRoutingModule } from './profile-routing.module';

import { ProfileComponent }            from './profile.component';
import { ProfileHeaderComponent }      from './profile-header.component';
import { ProfileGenreRowComponent }    from './profile-genre-row.component';
import { ProfileDirectorRowComponent } from './profile-director-row.component';
import { ProfileActorRowComponent }    from './profile-actor-row.component';
import { ProfileContrarianComponent }  from './profile-contrarian.component';
import { ProfileTrendChartComponent }  from './profile-trend-chart.component';
import { ProfilePosterGridComponent }  from './profile-poster-grid.component';
import { ProfileSuggestionsComponent } from './profile-suggestions.component';

@NgModule({
  declarations: [
    ProfileComponent,
    ProfileHeaderComponent,
    ProfileGenreRowComponent,
    ProfileDirectorRowComponent,
    ProfileActorRowComponent,
    ProfileContrarianComponent,
    ProfileTrendChartComponent,
    ProfilePosterGridComponent,
    ProfileSuggestionsComponent,
  ],
  imports: [SharedModule, ProfileRoutingModule],
})
export class ProfileModule {}
