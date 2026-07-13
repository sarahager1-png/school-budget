import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://njsanabfbmnaqvwraqdh.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_jcJExzHaRNNLVojqKzvt5w_DOzlfFxM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
