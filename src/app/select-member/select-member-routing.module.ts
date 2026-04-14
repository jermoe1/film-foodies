import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SelectMemberComponent } from './select-member.component';

const routes: Routes = [
  { path: '', component: SelectMemberComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SelectMemberRoutingModule {}
