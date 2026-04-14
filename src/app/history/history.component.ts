import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MemberService } from '../core/services/member.service';
import { HistoryService, HistoryCard, HistoryNote, HistoryFact, HistoryAttendee } from './history.service';

type HistoryTab = 'details' | 'trivia' | 'notes';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryComponent implements OnInit, OnDestroy {
  nights: HistoryCard[] = [];
  loading = true;

  expandedId: string | null = null;
  activeTab: HistoryTab = 'details';

  // Lazy-loaded per expanded card
  notesMap = new Map<string, HistoryNote[]>();
  triviaMap = new Map<string, HistoryFact[]>();
  notesLoadingSet = new Set<string>();
  triviaLoadingSet = new Set<string>();

  // Note add/edit state
  newNoteText = '';
  noteSubmitting = false;
  editingNoteId: string | null = null;
  editNoteText = '';
  editSubmitting = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private historyService: HistoryService,
    private memberService: MemberService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.historyService
      .getHistory()
      .pipe(takeUntil(this.destroy$))
      .subscribe((nights) => {
        this.nights = nights;
        this.loading = false;
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Card expand / collapse ───────────────────────────────────────────────────

  toggleExpand(id: string): void {
    if (this.expandedId === id) {
      this.expandedId = null;
      this.cdr.markForCheck();
      return;
    }
    this.expandedId = id;
    this.activeTab = 'details';
    this.newNoteText = '';
    this.editingNoteId = null;
    // Eagerly load notes so the tab badge count is ready
    if (!this.notesMap.has(id) && !this.notesLoadingSet.has(id)) {
      this.loadNotes(id);
    }
    this.cdr.markForCheck();
  }

  // ── Tab switching ────────────────────────────────────────────────────────────

  setTab(tab: HistoryTab, night: HistoryCard): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
    if (tab === 'notes' && !this.notesMap.has(night.id) && !this.notesLoadingSet.has(night.id)) {
      this.loadNotes(night.id);
    }
    if (tab === 'trivia' && !this.triviaMap.has(night.movie.id) && !this.triviaLoadingSet.has(night.movie.id)) {
      this.loadTrivia(night.movie.id);
    }
  }

  private loadNotes(movieNightId: string): void {
    this.notesLoadingSet.add(movieNightId);
    this.cdr.markForCheck();
    this.historyService
      .getNotes(movieNightId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((notes) => {
        this.notesMap.set(movieNightId, notes);
        this.notesLoadingSet.delete(movieNightId);
        this.cdr.markForCheck();
      });
  }

  private loadTrivia(movieId: string): void {
    this.triviaLoadingSet.add(movieId);
    this.cdr.markForCheck();
    this.historyService
      .getFacts(movieId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((facts) => {
        this.triviaMap.set(movieId, facts);
        this.triviaLoadingSet.delete(movieId);
        this.cdr.markForCheck();
      });
  }

  // ── Notes CRUD ───────────────────────────────────────────────────────────────

  addNote(night: HistoryCard): void {
    const memberId = this.memberService.currentMember?.id;
    if (!memberId || !this.newNoteText.trim() || this.noteSubmitting) return;

    this.noteSubmitting = true;
    this.cdr.markForCheck();

    this.historyService
      .addNote(night.id, memberId, this.newNoteText.trim())
      .pipe(takeUntil(this.destroy$))
      .subscribe((note) => {
        this.noteSubmitting = false;
        if (note) {
          const existing = this.notesMap.get(night.id) ?? [];
          this.notesMap.set(night.id, [...existing, note]);
          this.newNoteText = '';
        }
        this.cdr.markForCheck();
      });
  }

  startEditNote(note: HistoryNote): void {
    this.editingNoteId = note.id;
    this.editNoteText = note.noteText;
    this.cdr.markForCheck();
  }

  cancelEditNote(): void {
    this.editingNoteId = null;
    this.editNoteText = '';
    this.cdr.markForCheck();
  }

  saveEditNote(night: HistoryCard): void {
    if (!this.editingNoteId || !this.editNoteText.trim() || this.editSubmitting) return;

    const noteId = this.editingNoteId;
    const newText = this.editNoteText.trim();
    this.editSubmitting = true;
    this.cdr.markForCheck();

    this.historyService
      .updateNote(noteId, newText)
      .pipe(takeUntil(this.destroy$))
      .subscribe((ok) => {
        this.editSubmitting = false;
        if (ok) {
          const notes = (this.notesMap.get(night.id) ?? []).map((n) =>
            n.id === noteId ? { ...n, noteText: newText, isEdited: true } : n
          );
          this.notesMap.set(night.id, notes);
          this.editingNoteId = null;
          this.editNoteText = '';
        }
        this.cdr.markForCheck();
      });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  isNonEnglish(lang: string | null): boolean {
    if (!lang) return false;
    const lower = lang.toLowerCase();
    return !lower.startsWith('english') || lower.includes(',');
  }

  primaryLanguage(lang: string): string {
    return lang.split(', ')[0];
  }

  scoreColor(score: number): string {
    if (score >= 7.5) return '#4a9a5a';
    if (score >= 5.0) return '#d4a03a';
    return '#c04040';
  }

  formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatNoteDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }

  notesFor(id: string): HistoryNote[] {
    return this.notesMap.get(id) ?? [];
  }

  triviaFor(movieId: string): HistoryFact[] {
    return this.triviaMap.get(movieId) ?? [];
  }

  isNotesLoading(id: string): boolean {
    return this.notesLoadingSet.has(id);
  }

  isTriviaLoading(movieId: string): boolean {
    return this.triviaLoadingSet.has(movieId);
  }

  isMyNote(note: HistoryNote): boolean {
    return note.memberId === (this.memberService.currentMember?.id ?? '');
  }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  trackByMemberId(_: number, item: HistoryAttendee): string {
    return item.memberId;
  }
}
