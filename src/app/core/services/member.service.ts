import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';

export interface Member {
  id: string;
  full_name: string;
  first_name: string;
  avatar_color: string;
  display_order: number;
  is_admin: boolean;
  created_at: string;
}

const MEMBER_KEY = 'ff_current_member_id';

@Injectable({ providedIn: 'root' })
export class MemberService {
  private currentMemberSubject = new BehaviorSubject<Member | null>(null);

  /** Reactive stream of the currently selected member. */
  readonly currentMember$ = this.currentMemberSubject.asObservable();

  constructor(private supabase: SupabaseService) {}

  /** Snapshot of the currently selected member. */
  get currentMember(): Member | null {
    return this.currentMemberSubject.value;
  }

  /** True if the current member has admin privileges. */
  get isAdmin(): boolean {
    return this.currentMember?.is_admin ?? false;
  }

  /** Fetch all members ordered by display_order. */
  getAllMembers(): Observable<Member[]> {
    return from(
      this.supabase.getClient()
        .from('members')
        .select('*')
        .order('display_order', { ascending: true })
    ).pipe(
      map(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as Member[];
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Set the active member and persist their ID to local storage.
   * No password required — selection is purely by name picker.
   */
  selectMember(member: Member): void {
    this.currentMemberSubject.next(member);
    localStorage.setItem(MEMBER_KEY, member.id);
  }

  /**
   * Re-hydrate the current member from local storage on app startup.
   * Returns true if a saved member was found and loaded.
   */
  tryRestoreMemberFromStorage(): Observable<boolean> {
    const savedId = localStorage.getItem(MEMBER_KEY);
    if (!savedId) return of(false);

    return from(
      this.supabase.getClient()
        .from('members')
        .select('*')
        .eq('id', savedId)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error || !data) return false;
        this.currentMemberSubject.next(data as Member);
        return true;
      }),
      catchError(() => of(false))
    );
  }

  /** Clear the active member (e.g. from "Switch Names" menu item). */
  clearMember(): void {
    this.currentMemberSubject.next(null);
    localStorage.removeItem(MEMBER_KEY);
  }
}
