import { createClient } from '@supabase/supabase-js';

const processEnv =
  typeof process !== 'undefined' && typeof (process as any).env !== 'undefined'
    ? ((process as any).env as Record<string, string | undefined>)
    : undefined;

const supabaseUrl =
  processEnv?.NEXT_PUBLIC_SUPABASE_URL ||
  (typeof import.meta !== 'undefined' ? (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL : undefined);
const supabaseAnonKey =
  processEnv?.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  (typeof import.meta !== 'undefined' ? (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
