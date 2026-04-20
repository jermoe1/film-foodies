import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { takeUntil } from 'rxjs/operators';
import { MemberService, Member } from '../core/services/member.service';
import { DestroyComponent } from '../shared/util/destroy';
import { NavigationService } from '../shared/services/navigation.service';
import {
  BulkImportService,
  PreviewRow,
  ReadyRow,
  EnrichProgress,
  CSV_HEADERS,
  CSV_EXAMPLE,
} from './bulk-import.service';

type Step = 'upload' | 'preview' | 'enriching' | 'importing' | 'done' | 'error';

@Component({
  selector: 'app-bulk-import',
  templateUrl: './bulk-import.component.html',
  styleUrls: ['./bulk-import.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BulkImportComponent extends DestroyComponent implements OnInit {
  step: Step = 'upload';

  // Upload step
  csvText = '';
  pasteActive = false;
  dragOver = false;
  uploadError: string | null = null;

  // Preview step
  previewRows: PreviewRow[] = [];
  members: Member[] = [];

  // Enriching step
  enrichProgress: EnrichProgress = { current: 0, total: 0, title: '' };

  // Ready/import step
  readyRows: ReadyRow[] = [];
  importError: string | null = null;

  // Import submitting state
  isImporting = false;

  // Done step
  importedCount = 0;

  // Error report
  failedRows: PreviewRow[] = [];

  constructor(
    private nav: NavigationService,
    private bulkImport: BulkImportService,
    private memberService: MemberService,
    private cdr: ChangeDetectorRef,
  ) { super(); }

  ngOnInit(): void {
    this.memberService.getAllMembers()
      .pipe(takeUntil(this.destroy$))
      .subscribe((members) => {
        this.members = members;
        this.cdr.markForCheck();
      });
  }

  // ── Upload step ─────────────────────────────────────────────────────────────

  get csvTemplate(): string {
    return `${CSV_HEADERS}\n${CSV_EXAMPLE}`;
  }

  downloadTemplate(): void {
    const blob = new Blob([this.csvTemplate], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'film-foodies-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.readFile(file);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    const file = event.dataTransfer?.files[0];
    if (file && file.name.endsWith('.csv')) {
      this.readFile(file);
    } else {
      this.uploadError = 'Please drop a .csv file';
      this.cdr.markForCheck();
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
    this.cdr.markForCheck();
  }

  onDragLeave(): void {
    this.dragOver = false;
    this.cdr.markForCheck();
  }

  private readFile(file: File): void {
    this.uploadError = null;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.csvText = (e.target?.result as string) ?? '';
      this.processCSV();
    };
    reader.onerror = () => {
      this.uploadError = 'Could not read file';
      this.cdr.markForCheck();
    };
    reader.readAsText(file);
  }

  onPasteText(): void {
    this.pasteActive = true;
    this.uploadError = null;
    this.cdr.markForCheck();
  }

  onTextareaChange(value: string): void {
    this.csvText = value;
  }

  submitPaste(): void {
    if (!this.csvText.trim()) {
      this.uploadError = 'Please paste some CSV content';
      this.cdr.markForCheck();
      return;
    }
    this.processCSV();
  }

  cancelPaste(): void {
    this.pasteActive = false;
    this.csvText = '';
    this.uploadError = null;
    this.cdr.markForCheck();
  }

  private processCSV(): void {
    this.uploadError = null;
    const rows = this.bulkImport.parseAndValidate(this.csvText, this.members);
    if (rows.length === 0) {
      this.uploadError = 'No data rows found — make sure your CSV has a header row and at least one data row';
      this.pasteActive = true;
      this.cdr.markForCheck();
      return;
    }
    this.previewRows = rows;
    this.failedRows = rows.filter((r) => r.errors.length > 0);
    this.step = 'preview';
    this.cdr.markForCheck();
  }

  // ── Preview step ────────────────────────────────────────────────────────────

  get validRowCount(): number {
    return this.previewRows.filter((r) => r.errors.length === 0).length;
  }

  get invalidRowCount(): number {
    return this.failedRows.length;
  }

  get canEnrich(): boolean {
    return this.validRowCount > 0;
  }

  startEnrich(): void {
    this.step = 'enriching';
    this.enrichProgress = { current: 0, total: this.validRowCount, title: '' };
    this.cdr.markForCheck();

    this.bulkImport
      .enrichRows(this.previewRows, (p) => {
        this.enrichProgress = p;
        this.cdr.markForCheck();
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe((readyRows) => {
        this.readyRows = readyRows;
        this.step = 'importing';
        this.cdr.markForCheck();
      });
  }

  backToUpload(): void {
    this.step = 'upload';
    this.previewRows = [];
    this.failedRows = [];
    this.csvText = '';
    this.pasteActive = false;
    this.uploadError = null;
    this.cdr.markForCheck();
  }

  // ── Import step ─────────────────────────────────────────────────────────────

  get enrichProgressPct(): number {
    if (!this.enrichProgress.total) return 0;
    return Math.round((this.enrichProgress.current / this.enrichProgress.total) * 100);
  }

  confirmImport(): void {
    const createdBy = this.memberService.currentMember?.id;
    if (!createdBy) {
      this.importError = 'You must be signed in to import';
      this.cdr.markForCheck();
      return;
    }

    this.isImporting = true;
    this.importError = null;
    this.cdr.markForCheck();

    this.bulkImport
      .importNights(this.readyRows, createdBy)
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        this.isImporting = false;
        if (result.success) {
          this.importedCount = result.imported;
          this.step = 'done';
        } else {
          this.importError = result.error ?? 'Import failed';
          this.step = 'error';
        }
        this.cdr.markForCheck();
      });
  }

  // ── Done / error ─────────────────────────────────────────────────────────────

  downloadErrorReport(): void {
    const lines = [
      'row,date,title,imdb_id,host,errors',
      ...this.failedRows.map((r) =>
        [r.rowNum, r.date, r.title, r.imdbId, r.host, `"${r.errors.join('; ')}"`].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-errors.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  goHome(): void { this.nav.goHome(); }

  startOver(): void {
    this.step = 'upload';
    this.csvText = '';
    this.pasteActive = false;
    this.previewRows = [];
    this.failedRows = [];
    this.readyRows = [];
    this.importError = null;
    this.uploadError = null;
    this.importedCount = 0;
    this.isImporting = false;
    this.enrichProgress = { current: 0, total: 0, title: '' };
    this.cdr.markForCheck();
  }

  // ── Track ────────────────────────────────────────────────────────────────────

  trackByRowNum(_: number, r: PreviewRow): number { return r.rowNum; }
}
