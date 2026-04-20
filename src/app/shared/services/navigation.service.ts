import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

/**
 * Centralised navigation helpers — removes the per-component goBack / goHome
 * boilerplate that was duplicated across 10+ route components.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  constructor(private router: Router, private location: Location) {}

  goHome(): void {
    this.router.navigate(['/home']);
  }

  goBack(): void {
    this.location.back();
  }

  goTo(path: string): void {
    this.router.navigate([`/${path}`]);
  }
}
