import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SuggestionsComponent } from './suggestions.component';
import { SuggestNewComponent } from './suggest-new.component';

const routes: Routes = [
  { path: '',    component: SuggestionsComponent },
  { path: 'new', component: SuggestNewComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SuggestionsRoutingModule {}
