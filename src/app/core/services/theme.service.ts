import { Injectable } from '@angular/core';

export type Theme = 'cinema' | 'lobby' | 'high-contrast' | 'anti-glare' | 'colorblind' | 'forest';

const THEME_KEY = 'ff_theme';

export interface ThemeOption {
  value: Theme;
  label: string;
  bg: string;
  accent: string;
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly options: ThemeOption[] = [
    { value: 'cinema',        label: 'Cinema Mode',   bg: '#0d0d0d', accent: '#C8860A' },
    { value: 'lobby',         label: 'Lobby Mode',    bg: '#f5f0e8', accent: '#C8860A' },
    { value: 'high-contrast', label: 'High Contrast', bg: '#000000', accent: '#FFD700' },
    { value: 'anti-glare',    label: 'Anti-Glare',    bg: '#2a2a2a', accent: '#B8730A' },
    { value: 'colorblind',    label: 'Colorblind',    bg: '#0d0d0d', accent: '#1A4A8B' },
    { value: 'forest',        label: 'Forest Mode',   bg: '#0a2a0a', accent: '#4A8B2A' },
  ];

  get current(): Theme {
    return (localStorage.getItem(THEME_KEY) as Theme) ?? 'cinema';
  }

  /** Apply a theme and persist it to local storage. */
  apply(theme: Theme): void {
    localStorage.setItem(THEME_KEY, theme);
    this.applyToBody(theme);
  }

  /** Called once at app startup to restore the saved theme. */
  init(): void {
    this.applyToBody(this.current);
  }

  private applyToBody(theme: Theme): void {
    const classes = Array.from(document.body.classList).filter(
      (c) => !c.startsWith('theme-')
    );
    document.body.className = classes.join(' ').trim();
    if (theme !== 'cinema') {
      document.body.classList.add(`theme-${theme}`);
    }
  }
}
