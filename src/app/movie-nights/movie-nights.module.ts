import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { MovieNightsRoutingModule } from './movie-nights-routing.module';
import { MovieNightsComponent } from './movie-nights.component';

@NgModule({
  declarations: [MovieNightsComponent],
  imports: [SharedModule, MovieNightsRoutingModule],
})
export class MovieNightsModule {}
