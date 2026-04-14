import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MovieNightsComponent } from './movie-nights.component';

const routes: Routes = [
  { path: '', component: MovieNightsComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MovieNightsRoutingModule {}
