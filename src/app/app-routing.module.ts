import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'home',
    loadChildren: () =>
      import('./home/home.module').then((m) => m.HomeModule),
  },
  {
    path: 'suggest',
    loadChildren: () =>
      import('./suggestions/suggestions.module').then((m) => m.SuggestionsModule),
  },
  {
    path: 'movie-night',
    loadChildren: () =>
      import('./movie-nights/movie-nights.module').then((m) => m.MovieNightsModule),
  },
  {
    path: 'rate',
    loadChildren: () =>
      import('./ratings/ratings.module').then((m) => m.RatingsModule),
  },
  {
    path: 'history',
    loadChildren: () =>
      import('./history/history.module').then((m) => m.HistoryModule),
  },
  {
    path: 'stats',
    loadChildren: () =>
      import('./stats/stats.module').then((m) => m.StatsModule),
  },
  {
    path: 'profile',
    loadChildren: () =>
      import('./profile/profile.module').then((m) => m.ProfileModule),
  },
  {
    path: 'discover',
    loadChildren: () =>
      import('./discovery/discovery.module').then((m) => m.DiscoveryModule),
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./admin/admin.module').then((m) => m.AdminModule),
  },
  {
    path: 'bulk-import',
    loadChildren: () =>
      import('./bulk-import/bulk-import.module').then((m) => m.BulkImportModule),
  },
  {
    path: '**',
    redirectTo: 'home',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
