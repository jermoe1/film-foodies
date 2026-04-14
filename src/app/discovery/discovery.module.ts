import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { DiscoveryRoutingModule } from './discovery-routing.module';
import { DiscoveryComponent } from './discovery.component';

@NgModule({
  declarations: [DiscoveryComponent],
  imports: [SharedModule, DiscoveryRoutingModule],
})
export class DiscoveryModule {}
