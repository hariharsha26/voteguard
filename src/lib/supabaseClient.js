import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const appEnv = import.meta.env.VITE_APP_ENV;

if (!supabaseUrl || !supabaseAnonKey || !appEnv) {
  throw new Error('[VoteGuard Client Error] Missing critical environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, or VITE_APP_ENV).');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
