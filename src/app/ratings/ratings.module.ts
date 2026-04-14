import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { RatingsRoutingModule } from './ratings-routing.module';
import { RatingsComponent } from './ratings.component';

@NgModule({
  declarations: [RatingsComponent],
  imports: [SharedModule, RatingsRoutingModule],
})
export class RatingsModule {}
