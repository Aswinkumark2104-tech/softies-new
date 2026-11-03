import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT') && !key.includes('YOUR_SUPABASE_'));
export const supabase = supabaseConfigured ? createClient(url, key) : null;
