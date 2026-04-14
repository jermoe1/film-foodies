import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { StatsRoutingModule } from './stats-routing.module';
import { StatsComponent } from './stats.component';

@NgModule({
  declarations: [StatsComponent],
  imports: [SharedModule, StatsRoutingModule],
})
export class StatsModule {}
