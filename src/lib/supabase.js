import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jhtajcejwxfcksvjzkzx.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpodGFqY2Vqd3hmY2tzdmp6a3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxODg5NDcsImV4cCI6MjA5Mzc2NDk0N30.WNqCorKmi-w6LcUdp-w-RwBmwS5jYQln-_lNuqILAFU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const isMockMode = false;
