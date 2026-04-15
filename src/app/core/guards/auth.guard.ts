import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Blocks all protected routes until the site-wide passcode has been verified.
 * Redirects to /select-member where the passcode entry lives.
 * Routes /select-member and /admin are intentionally left unguarded.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated) return true;

  return router.createUrlTree(['/select-member']);
};
