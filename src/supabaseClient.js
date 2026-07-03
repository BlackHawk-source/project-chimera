import { createClient } from '@supabase/supabase-js';

// Pulling securely from system variables depending on environment (Local vs Vercel)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://axofxnqyipvqejzygyhr.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0ODt-vdw74ymzV-wa4DdQA_G5uFFum3';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);