import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { MemberService, Member } from '../core/services/member.service';
import { SupabaseService } from '../core/services/supabase.service';

@Component({
  selector: 'app-select-member',
  templateUrl: './select-member.component.html',
  styleUrls: ['./select-member.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectMemberComponent implements OnInit {
  members: Member[] = [];
  isLoading = true;
  isConfigured = false;

  constructor(
    private memberService: MemberService,
    private supabase: SupabaseService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.isConfigured = this.supabase.isConfigured;

    if (!this.isConfigured) {
      this.isLoading = false;
      this.cdr.markForCheck();
      return;
    }

    this.memberService.getAllMembers().subscribe((members) => {
      this.members = members;
      this.isLoading = false;
      this.cdr.markForCheck();
    });
  }

  selectMember(member: Member): void {
    this.memberService.selectMember(member);
    this.router.navigate(['/home']);
  }

  goToSettings(): void {
    this.router.navigate(['/admin']);
  }

  /** First letter of first name, uppercased. */
  initial(member: Member): string {
    return member.first_name.charAt(0).toUpperCase();
  }
}
