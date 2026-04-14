import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
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
   * Verify the entered passcode against the SHA-256 hash stored in app_settings.
   * Sets the local storage flag on success so re-entry is skipped until passcode changes.
   */
  verifyPasscode(passcode: string): Observable<boolean> {
    return from(this.hashPasscode(passcode)).pipe(
      switchMap((hash) =>
        from(
          this.supabase
            .getClient()
            .from('app_settings')
            .select('passcode_hash')
            .single()
        ).pipe(
          map(({ data, error }) => {
            if (error || !data) return false;
            const matches = (data as any)['passcode_hash'] === hash;
            if (matches) localStorage.setItem(PASSCODE_KEY, 'true');
            return matches;
          }),
          catchError(() => of(false))
        )
      )
    );
  }

  /**
   * Set a new passcode: hash it with SHA-256 and write to app_settings.
   * Clears all cached verifications so all members must re-enter the new passcode.
   */
  setPasscode(newPasscode: string): Observable<boolean> {
    return from(this.hashPasscode(newPasscode)).pipe(
      switchMap((hash) =>
        from(
          this.supabase
            .getClient()
            .from('app_settings')
            .update({ passcode_hash: hash, updated_at: new Date().toISOString() })
            .not('id', 'is', null)
        ).pipe(
          map(({ error }) => {
            if (!error) this.clearVerification();
            return !error;
          }),
          catchError(() => of(false))
        )
      )
    );
  }

  /** Invalidate the cached passcode verification (e.g. after passcode change). */
  clearVerification(): void {
    localStorage.removeItem(PASSCODE_KEY);
  }

  /**
   * Hash a passcode using the Web Crypto API (SHA-256).
   * The hash stored in app_settings must be generated with the same algorithm.
   */
  async hashPasscode(passcode: string): Promise<string> {
    const encoded = new TextEncoder().encode(passcode);
    const buffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}
