import { createClient } from '@supabase/supabase-js';

// Browser auth client (client-safe publishable key).
const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const supabase = createClient(url, key);
