import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@/environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      /**
       * Default Supabase auth uses `navigator.locks`, which often conflicts with Angular's Zone.js
       * and can throw NavigatorLockAcquireTimeoutError → blank screen. A no-op lock is fine for
       * a single mobile/WebView client; multi-tab sync is less critical for Capacitor.
       */
      lock: async (_name, _acquireTimeout, fn) => await fn(),
    },
  });
}
