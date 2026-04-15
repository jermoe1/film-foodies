import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  // ── Unguarded: passcode entry + member picker, and admin setup ────────────
  {
    path: 'select-member',
    loadChildren: () =>
      import('./select-member/select-member.module').then((m) => m.SelectMemberModule),
  },
  {
    path: 'admin',
    loadChildren: () =>
      import('./admin/admin.module').then((m) => m.AdminModule),
  },
  // ── Protected: require passcode verification ──────────────────────────────
  {
    path: 'home',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./home/home.module').then((m) => m.HomeModule),
  },
  {
    path: 'suggest',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./suggestions/suggestions.module').then((m) => m.SuggestionsModule),
  },
  {
    path: 'movie-night',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./movie-nights/movie-nights.module').then((m) => m.MovieNightsModule),
  },
  {
    path: 'rate',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./ratings/ratings.module').then((m) => m.RatingsModule),
  },
  {
    path: 'history',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./history/history.module').then((m) => m.HistoryModule),
  },
  {
    path: 'stats',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./stats/stats.module').then((m) => m.StatsModule),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./profile/profile.module').then((m) => m.ProfileModule),
  },
  {
    path: 'discover',
    canActivate: [authGuard],
    loadChildren: () =>
      import('./discovery/discovery.module').then((m) => m.DiscoveryModule),
  },
  {
    path: 'bulk-import',
    canActivate: [authGuard],
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
