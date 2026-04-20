import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'ff_supabase_config';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private client: SupabaseClient | null = null;

  get isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Initialize the Supabase client with URL and anon key, then persist to local storage.
   * Called from the in-app config screen (Settings > API Keys) for local dev overrides.
   */
  initialize(url: string, anonKey: string): void {
    this.client = createClient(url, anonKey);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, anonKey }));
  }

  /**
   * Attempt to initialize the Supabase client. Priority order:
   * 1. Baked-in environment credentials (set at build time via GitHub secrets)
   * 2. Credentials previously saved to local storage via the Settings screen
   * Returns true if a client was successfully created.
   */
  tryInitFromStorage(): boolean {
    // 1. Environment credentials (injected at build time — never in git)
    if (environment.supabaseUrl && environment.supabaseAnonKey) {
      this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
      return true;
    }

    // 2. Local storage fallback (used during local development)
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
   * Returns the client if initialized, or null. Safe to call without an
   * isConfigured check — preferred over getClient() inside services.
   */
  getClientOrNull(): SupabaseClient | null {
    return this.client;
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
   * Note: environment-baked credentials are unaffected — only localStorage is cleared.
   */
  clearConfig(): void {
    this.client = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}
