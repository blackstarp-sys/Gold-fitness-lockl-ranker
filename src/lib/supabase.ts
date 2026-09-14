import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = '';
const DEFAULT_ANON_KEY = '';
const DEFAULT_SERVICE_ROLE_KEY = '';
export const SUPABASE_PUBLISHABLE_KEY = '';

function getEnvVar(key: string, viteKey?: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[key]) return process.env[key];
    if (viteKey && process.env[viteKey]) return process.env[viteKey];
  }
  try {
    const meta = (typeof import.meta !== 'undefined' ? import.meta : undefined) as any;
    if (viteKey && meta?.env && meta.env[viteKey]) {
      return meta.env[viteKey];
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function getSupabaseUrl(): string {
  return getEnvVar('SUPABASE_URL', 'VITE_SUPABASE_URL') || DEFAULT_SUPABASE_URL;
}

export function getSupabaseAnonKey(): string {
  return getEnvVar('SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY') || DEFAULT_ANON_KEY;
}

export function getSupabaseServiceRoleKey(): string {
  return getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || DEFAULT_SERVICE_ROLE_KEY;
}

// Client-side singleton
let supabaseClientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClientInstance) {
    const url = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    supabaseClientInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });

    if (typeof window !== 'undefined') {
      (window as any).supabase = supabaseClientInstance;
    }
  }
  return supabaseClientInstance;
}

export const supabase = getSupabaseClient();

// Server-side admin client (service_role)
let supabaseAdminInstance: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdminInstance) {
    const url = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceRoleKey();
    supabaseAdminInstance = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return supabaseAdminInstance;
}
