import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './core/services/supabase.service';
import { MemberService } from './core/services/member.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  constructor(
    private supabase: SupabaseService,
    private memberService: MemberService,
    private themeService: ThemeService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Apply saved theme immediately to avoid flash
    this.themeService.init();

    // Restore Supabase connection from local storage
    this.supabase.tryInitFromStorage();

    if (!this.supabase.isConfigured) {
      // Skip redirect if already heading to admin
      if (!this.router.url.includes('admin')) {
        this.router.navigate(['/admin']);
      }
      return;
    }

    // Restore member selection from local storage
    this.memberService.tryRestoreMemberFromStorage().subscribe((found) => {
      if (!found && !this.router.url.includes('select-member')) {
        this.router.navigate(['/select-member']);
      }
    });
  }
}
