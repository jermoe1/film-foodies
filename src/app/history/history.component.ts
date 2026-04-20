import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { MemberService } from '../core/services/member.service';
import { HistoryService, HistoryCard, HistoryNote, HistoryFact, HistoryAttendee } from './history.service';
import { DestroyComponent } from '../shared/util/destroy';
import { NavigationService } from '../shared/services/navigation.service';
import { isNonEnglish } from '../shared/util/language';
import { scoreColor } from '../shared/util/score';
import { parseYyyyMmDd } from '../shared/util/date';

type HistoryTab = 'details' | 'trivia' | 'notes';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryComponent extends DestroyComponent implements OnInit {
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

  // Delete state
  deleteConfirmId: string | null = null;
  deleteSubmitting = false;

  constructor(
    private nav: NavigationService,
    private historyService: HistoryService,
    private memberService: MemberService,
    private cdr: ChangeDetectorRef,
  ) { super(); }

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

  // ── Card expand / collapse ───────────────────────────────────────────────────

  toggleExpand(id: string): void {
    if (this.expandedId === id) {
      this.expandedId = null;
      this.deleteConfirmId = null;
      this.cdr.markForCheck();
      return;
    }
    this.expandedId = id;
    this.activeTab = 'details';
    this.newNoteText = '';
    this.editingNoteId = null;
    this.deleteConfirmId = null;
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

  // ── Delete ───────────────────────────────────────────────────────────────────

  confirmDelete(nightId: string): void {
    this.deleteConfirmId = nightId;
    this.cdr.markForCheck();
  }

  cancelDelete(): void {
    this.deleteConfirmId = null;
    this.cdr.markForCheck();
  }

  executeDelete(nightId: string): void {
    if (this.deleteSubmitting) return;
    this.deleteSubmitting = true;
    this.cdr.markForCheck();

    this.historyService
      .deleteNight(nightId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((ok) => {
        this.deleteSubmitting = false;
        if (ok) {
          this.nights = this.nights.filter((n) => n.id !== nightId);
          this.expandedId = null;
          this.deleteConfirmId = null;
        }
        this.cdr.markForCheck();
      });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  isNonEnglish(lang: string | null): boolean { return isNonEnglish(lang); }

  primaryLanguage(lang: string): string {
    return lang.split(', ')[0];
  }

  scoreColor(score: number): string { return scoreColor(score); }

  formatDate(dateStr: string): string {
    return parseYyyyMmDd(dateStr).toLocaleDateString('en-US', {
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

  goBack(): void { this.nav.goHome(); }

  trackById(_: number, item: { id: string }): string {
    return item.id;
  }

  trackByMemberId(_: number, item: HistoryAttendee): string {
    return item.memberId;
  }
}
