import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../core/services/supabase.service';
import { MemberService, Member } from '../core/services/member.service';
import { AuthService } from '../core/services/auth.service';
import { ThemeService, Theme } from '../core/services/theme.service';
import { AdminService, AppSettings, AVATAR_COLORS } from '../core/services/admin.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminComponent implements OnInit {
  // ── Theme ────────────────────────────────────────────────────────────────
  currentTheme: Theme = 'cinema';

  // ── Passcode ─────────────────────────────────────────────────────────────
  newPasscode = '';
  passcodeError = '';
  passcodeSaved = false;
  isSavingPasscode = false;

  // ── Members ───────────────────────────────────────────────────────────────
  members: Member[] = [];
  isMembersLoading = true;
  editingMemberId: string | null = null;
  editFirstName = '';
  editFullName = '';
  isRenameSaving = false;

  // Add member form
  addFirstName = '';
  addFullName = '';
  addAvatarColor = AVATAR_COLORS[0];
  isAddSaving = false;
  addError = '';
  addSuccess = false;
  showAddForm = false;

  // ── App info ──────────────────────────────────────────────────────────────
  appSettings: AppSettings | null = null;

  readonly avatarColors = AVATAR_COLORS;

  constructor(
    private supabaseService: SupabaseService,
    private memberService: MemberService,
    private authService: AuthService,
    readonly themeService: ThemeService,
    private adminService: AdminService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.currentTheme = this.themeService.current;

    if (this.supabaseService.isConfigured) {
      this.loadMembers();
      this.adminService.getAppSettings().subscribe((s) => {
        this.appSettings = s;
        this.cdr.markForCheck();
      });
    } else {
      this.isMembersLoading = false;
    }
  }

  get isConfigured(): boolean { return this.supabaseService.isConfigured; }
  get isAdmin(): boolean { return this.memberService.isAdmin; }

  goBack(): void {
    this.router.navigate(['/home']);
  }

  // ── Theme ─────────────────────────────────────────────────────────────────

  selectTheme(theme: Theme): void {
    this.currentTheme = theme;
    this.themeService.apply(theme);
    this.cdr.markForCheck();
  }

  // ── Passcode ──────────────────────────────────────────────────────────────

  savePasscode(): void {
    if (this.newPasscode.length !== 6 || !/^\d+$/.test(this.newPasscode)) {
      this.passcodeError = 'Passcode must be exactly 6 digits.';
      this.cdr.markForCheck();
      return;
    }
    this.isSavingPasscode = true;
    this.passcodeError = '';
    this.passcodeSaved = false;

    this.authService.setPasscode(this.newPasscode).subscribe((ok) => {
      this.isSavingPasscode = false;
      if (ok) {
        this.passcodeSaved = true;
        this.newPasscode = '';
      } else {
        this.passcodeError = 'Failed to save passcode. Check your connection.';
      }
      this.cdr.markForCheck();
    });
  }

  // ── Members ────────────────────────────────────────────────────────────────

  loadMembers(): void {
    this.isMembersLoading = true;
    this.memberService.getAllMembers().subscribe((m) => {
      this.members = m;
      this.isMembersLoading = false;
      this.cdr.markForCheck();
    });
  }

  startEdit(member: Member): void {
    this.editingMemberId = member.id;
    this.editFirstName = member.first_name;
    this.editFullName = member.full_name;
    this.cdr.markForCheck();
  }

  cancelEdit(): void {
    this.editingMemberId = null;
    this.cdr.markForCheck();
  }

  saveMemberName(): void {
    if (!this.editingMemberId || !this.editFirstName.trim()) return;
    this.isRenameSaving = true;
    this.adminService
      .renameMember(this.editingMemberId, this.editFirstName, this.editFullName)
      .subscribe((ok) => {
        this.isRenameSaving = false;
        if (ok) {
          this.editingMemberId = null;
          this.loadMembers();
        }
        this.cdr.markForCheck();
      });
  }

  moveMember(member: Member, dir: 'up' | 'down'): void {
    this.adminService.moveMember(member, dir, this.members).subscribe((ok) => {
      if (ok) this.loadMembers();
    });
  }

  initial(member: Member): string {
    return member.first_name.charAt(0).toUpperCase();
  }

  isFirst(member: Member): boolean {
    const sorted = [...this.members].sort((a, b) => a.display_order - b.display_order);
    return sorted[0]?.id === member.id;
  }

  isLast(member: Member): boolean {
    const sorted = [...this.members].sort((a, b) => a.display_order - b.display_order);
    return sorted[sorted.length - 1]?.id === member.id;
  }

  toggleAddForm(): void {
    this.showAddForm = !this.showAddForm;
    this.addFirstName = '';
    this.addFullName = '';
    this.addAvatarColor = AVATAR_COLORS[0];
    this.addError = '';
    this.addSuccess = false;
    this.cdr.markForCheck();
  }

  addMember(): void {
    if (!this.addFirstName.trim()) {
      this.addError = 'First name is required.';
      this.cdr.markForCheck();
      return;
    }
    this.isAddSaving = true;
    this.addError = '';
    this.adminService
      .addMember(
        this.addFirstName,
        this.addFullName || this.addFirstName,
        this.addAvatarColor,
        this.members
      )
      .subscribe((member) => {
        this.isAddSaving = false;
        if (member) {
          this.addSuccess = true;
          this.showAddForm = false;
          this.loadMembers();
        } else {
          this.addError = 'Failed to add member. Check your connection.';
        }
        this.cdr.markForCheck();
      });
  }

  trackById(_: number, m: Member): string { return m.id; }
}
