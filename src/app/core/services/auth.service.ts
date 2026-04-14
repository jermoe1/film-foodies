import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';

const PASSCODE_KEY = 'ff_passcode_verified';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private supabase: SupabaseService) {}

  /**
   * True if the user has already verified the site-wide passcode this session.
   * Cached in local storage — cleared on passcode change.
   */
  get isAuthenticated(): boolean {
    return localStorage.getItem(PASSCODE_KEY) === 'true';
  }

  /**
   * Verify the entered passcode against the hash stored in app_settings.
   * Sets the local storage flag on success so re-entry is skipped until passcode changes.
   */
  verifyPasscode(passcode: string): Observable<boolean> {
    return from(
      this.supabase.getClient()
        .from('app_settings')
        .select('passcode_hash')
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return false;
        const hash = this.hashPasscode(passcode);
        const matches = data['passcode_hash'] === hash;
        if (matches) {
          localStorage.setItem(PASSCODE_KEY, 'true');
        }
        return matches;
      }),
      catchError(() => of(false))
    );
  }

  /**
   * Invalidate the cached passcode verification (e.g. after passcode change in Settings).
   */
  clearVerification(): void {
    localStorage.removeItem(PASSCODE_KEY);
  }

  /**
   * Hash a passcode using the Web Crypto API (SHA-256).
   * Stored hash in Supabase must be generated with the same algorithm.
   * TODO: wire up SHA-256 hash generation in Settings when setting the passcode.
   */
  hashPasscode(passcode: string): string {
    // Placeholder: btoa is not cryptographically secure.
    // TODO: replace with Web Crypto API SHA-256 once Settings screen is built.
    return btoa(passcode);
  }
}
