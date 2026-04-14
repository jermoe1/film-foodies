import { NgModule } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { SelectMemberRoutingModule } from './select-member-routing.module';
import { SelectMemberComponent } from './select-member.component';

@NgModule({
  declarations: [SelectMemberComponent],
  imports: [SharedModule, SelectMemberRoutingModule],
})
export class SelectMemberModule {}
