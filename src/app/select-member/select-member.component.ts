import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { MemberService, Member } from '../core/services/member.service';
import { SupabaseService } from '../core/services/supabase.service';
import { AuthService } from '../core/services/auth.service';

type View = 'checking' | 'passcode' | 'picker';

@Component({
  selector: 'app-select-member',
  templateUrl: './select-member.component.html',
  styleUrls: ['./select-member.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectMemberComponent implements OnInit {
  view: View = 'checking';
  members: Member[] = [];
  isLoadingMembers = false;
  isConfigured = false;

  // Passcode step
  passcodeInput = '';
  passcodeError: string | null = null;
  isVerifying = false;

  @ViewChild('pinInput') pinInputRef?: ElementRef<HTMLInputElement>;

  constructor(
    private memberService: MemberService,
    private supabase: SupabaseService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isConfigured = this.supabase.isConfigured;

    if (!this.isConfigured) {
      this.view = 'picker'; // will show "not configured" state
      this.cdr.markForCheck();
      return;
    }

    // If already authenticated (e.g. returning user same device), skip to picker
    if (this.authService.isAuthenticated) {
      this.showPicker();
      return;
    }

    // Check if a passcode is configured
    this.authService.hasPasscode().subscribe((hasPc) => {
      if (hasPc) {
        this.view = 'passcode';
        this.cdr.markForCheck();
        // Focus the hidden input after render
        setTimeout(() => this.pinInputRef?.nativeElement?.focus(), 50);
      } else {
        // No passcode set — authenticate transparently and go straight to picker
        this.authService.markAuthenticated();
        this.showPicker();
      }
    });
  }

  private showPicker(): void {
    this.view = 'picker';
    this.isLoadingMembers = true;
    this.cdr.markForCheck();

    this.memberService.getAllMembers().subscribe((members) => {
      this.members = members;
      this.isLoadingMembers = false;
      this.cdr.markForCheck();
    });
  }

  // ── Passcode entry ──────────────────────────────────────────────────────────

  get pinDots(): boolean[] {
    return Array.from({ length: 6 }, (_, i) => i < this.passcodeInput.length);
  }

  onPinInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 6);
    this.passcodeInput = val;
    // Keep the input element in sync (in case the browser added non-digits)
    (event.target as HTMLInputElement).value = val;
    this.passcodeError = null;
    this.cdr.markForCheck();

    if (val.length === 6) {
      this.submitPasscode();
    }
  }

  submitPasscode(): void {
    if (this.passcodeInput.length !== 6 || this.isVerifying) return;

    this.isVerifying = true;
    this.passcodeError = null;
    this.cdr.markForCheck();

    this.authService.verifyPasscode(this.passcodeInput).subscribe((ok) => {
      this.isVerifying = false;
      if (ok) {
        this.showPicker();
      } else {
        this.passcodeError = 'Incorrect passcode';
        this.passcodeInput = '';
        if (this.pinInputRef) this.pinInputRef.nativeElement.value = '';
        setTimeout(() => this.pinInputRef?.nativeElement?.focus(), 0);
        this.cdr.markForCheck();
      }
    });
  }

  focusPin(): void {
    this.pinInputRef?.nativeElement?.focus();
  }

  // ── Member picker ───────────────────────────────────────────────────────────

  selectMember(member: Member): void {
    this.memberService.selectMember(member);
    this.router.navigate(['/home']);
  }

  goToSettings(): void {
    this.router.navigate(['/admin']);
  }

  initial(member: Member): string {
    return member.first_name.charAt(0).toUpperCase();
  }
}
