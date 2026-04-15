import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ContentWarning } from '../../suggestions/suggestions.types';
import { environment } from '../../../environments/environment';

const DTDD_BASE = 'https://www.doesthedogdie.com/media/';

interface DtddTopicStat {
  topic: {
    topicName: string;
    simpleQuestion: string;
    isActive: boolean;
  };
  yes: number;
  no: number;
}

@Injectable({ providedIn: 'root' })
export class ContentWarningService {

  get apiKey(): string | null {
    // Environment key (baked in at build time via GitHub secret) takes priority
    if (environment.dtddApiKey) return environment.dtddApiKey;
    return null;
  }

  get hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Fetch content warnings from DoesTheDogDie.com for a given IMDb ID.
   * Returns an empty array if the API key is not configured or the request fails.
   * Results are sorted severe → moderate → mild.
   */
  fetchWarnings(imdbId: string): Observable<ContentWarning[]> {
    const key = this.apiKey;
    if (!key) return of([]);

    return from(
      fetch(`${DTDD_BASE}${imdbId}`, {
        headers: { 'X-API-KEY': key, 'Accept': 'application/json' },
      }).then((r) => {
        if (!r.ok) throw new Error(`DTDD ${r.status}`);
        return r.json();
      })
    ).pipe(
      map((json: any) => this.parse(json, imdbId)),
      catchError(() => of([] as ContentWarning[]))
    );
  }

  private parse(json: any, imdbId: string): ContentWarning[] {
    const stats: DtddTopicStat[] = json?.topicItemStats ?? [];
    const sourceUrl = `https://www.doesthedogdie.com/media/${imdbId}`;

    return stats
      .filter(
        (s) =>
          s.topic.isActive &&
          s.yes > 0 &&
          (s.yes + s.no === 0 || s.yes / (s.yes + s.no) >= 0.5)
      )
      .map((s) => ({
        warning: s.topic.simpleQuestion,
        severity: this.severity(s.yes),
        source: 'DoesTheDogDie.com',
        source_url: sourceUrl,
      }))
      .sort((a, b) => this.ord(b.severity) - this.ord(a.severity));
  }

  private severity(yesCount: number): 'mild' | 'moderate' | 'severe' {
    if (yesCount >= 8) return 'severe';
    if (yesCount >= 3) return 'moderate';
    return 'mild';
  }

  private ord(s: 'mild' | 'moderate' | 'severe'): number {
    return s === 'severe' ? 3 : s === 'moderate' ? 2 : 1;
  }
}
