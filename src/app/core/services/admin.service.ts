import { Injectable } from '@angular/core';
import { Observable, from, of, forkJoin } from 'rxjs';
import { map, catchError, switchMap } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { Member } from './member.service';

export interface AppSettings {
  id: string;
  passcodeHash: string | null;
  omdbCallsToday: number;
  omdbCallsResetDate: string;
  omdbRefreshInProgress: boolean;
  updatedAt: string;
}

export const AVATAR_COLORS = [
  '#C8860A', // Gold
  '#C04040', // Crimson
  '#4070D0', // Blue
  '#40A060', // Green
  '#A040C0', // Purple
  '#40A0C0', // Teal
  '#C07040', // Amber
  '#8060C0', // Lavender
];

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private supabase: SupabaseService) {}

  private get client() {
    try { return this.supabase.getClient(); } catch { return null; }
  }

  // ── App Settings ─────────────────────────────────────────────────────────

  getAppSettings(): Observable<AppSettings | null> {
    const client = this.client;
    if (!client) return of(null);
    return from(
      client.from('app_settings').select('*').single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        const r = data as any;
        return {
          id: r.id,
          passcodeHash: r.passcode_hash ?? null,
          omdbCallsToday: r.omdb_calls_today ?? 0,
          omdbCallsResetDate: r.omdb_calls_reset_date ?? '',
          omdbRefreshInProgress: r.omdb_refresh_in_progress ?? false,
          updatedAt: r.updated_at ?? '',
        } as AppSettings;
      }),
      catchError(() => of(null))
    );
  }

  // ── Member CRUD ──────────────────────────────────────────────────────────

  /**
   * Add a new member. Display order is set to max(existing) + 1.
   */
  addMember(
    firstName: string,
    fullName: string,
    avatarColor: string,
    allMembers: Member[]
  ): Observable<Member | null> {
    const client = this.client;
    if (!client) return of(null);
    const nextOrder =
      allMembers.length > 0
        ? Math.max(...allMembers.map((m) => m.display_order)) + 1
        : 0;
    return from(
      client
        .from('members')
        .insert({
          first_name: firstName.trim(),
          full_name: fullName.trim(),
          avatar_color: avatarColor,
          display_order: nextOrder,
          is_admin: false,
        })
        .select('*')
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return null;
        return data as Member;
      }),
      catchError(() => of(null))
    );
  }

  /**
   * Update a member's first name and full name.
   */
  renameMember(
    id: string,
    firstName: string,
    fullName: string
  ): Observable<boolean> {
    const client = this.client;
    if (!client) return of(false);
    return from(
      client
        .from('members')
        .update({ first_name: firstName.trim(), full_name: fullName.trim() })
        .eq('id', id)
    ).pipe(
      map(({ error }) => !error),
      catchError(() => of(false))
    );
  }

  /**
   * Move a member up or down in display_order by swapping with the adjacent member.
   */
  moveMember(
    member: Member,
    direction: 'up' | 'down',
    allMembers: Member[]
  ): Observable<boolean> {
    const client = this.client;
    if (!client) return of(false);

    const sorted = [...allMembers].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((m) => m.id === member.id);
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= sorted.length) return of(false);

    const other = sorted[targetIdx];
    const aOrder = member.display_order;
    const bOrder = other.display_order;

    // Swap display_order values — two sequential updates (no UNIQUE constraint to worry about)
    const updateA$ = from(
      client.from('members').update({ display_order: bOrder }).eq('id', member.id)
    ).pipe(map(({ error }) => !error), catchError(() => of(false)));

    const updateB$ = from(
      client.from('members').update({ display_order: aOrder }).eq('id', other.id)
    ).pipe(map(({ error }) => !error), catchError(() => of(false)));

    return updateA$.pipe(
      switchMap((ok) => (ok ? updateB$ : of(false)))
    );
  }
}
