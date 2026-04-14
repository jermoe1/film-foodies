import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY = 'ff_supabase_config';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private client: SupabaseClient | null = null;

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Initialize the Supabase client with URL and anon key, then persist to local storage.
   * Called from the in-app config screen (Settings > API Keys).
   * Keys are NEVER committed to the repo — stored in browser local storage only.
   */
  initialize(url: string, anonKey: string): void {
    this.client = createClient(url, anonKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, anonKey }));
  }

  /**
   * Attempt to restore the Supabase client from a previously saved config in local storage.
   * Called once at app startup (AppComponent.ngOnInit).
   */
  tryInitFromStorage(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    try {
      const { url, anonKey } = JSON.parse(stored);
      if (url && anonKey) {
        this.client = createClient(url, anonKey);
        return true;
      }
    } catch {
      // Corrupt storage entry — clear it
      localStorage.removeItem(STORAGE_KEY);
    }
    return false;
  }

  /**
   * Returns the initialized Supabase client.
   * Throws if not yet configured — callers should check isConfigured first.
   */
  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Supabase client not initialized. Configure API keys first.');
    }
    return this.client;
  }

  /**
   * Clear stored config (e.g. for reset / re-configuration).
   */
  clearConfig(): void {
    this.client = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}
