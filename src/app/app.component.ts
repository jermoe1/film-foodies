import { Component, OnInit } from '@angular/core';
import { SupabaseService } from './core/services/supabase.service';
import { MemberService } from './core/services/member.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  constructor(
    private supabase: SupabaseService,
    private memberService: MemberService,
  ) {}

  ngOnInit(): void {
    // Restore Supabase connection from local storage if previously configured
    this.supabase.tryInitFromStorage();

    // Restore previously selected member from local storage
    if (this.supabase.isConfigured) {
      this.memberService.tryRestoreMemberFromStorage().subscribe();
    }
  }
}
