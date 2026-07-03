import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://axofxnqyipvqejzygyhr.supabase.co';
// Make sure this anon key has no spaces or missing letters inside the single quotes
const supabaseAnonKey = 'sb_publishable_0ODt-vdw74ymzV-wa4DdQA_G5uFFum3'; 

export const supabase = createClient(supabaseUrl, supabaseAnonKey);