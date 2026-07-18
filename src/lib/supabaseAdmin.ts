import { createClient } from '@supabase/supabase-js';

// Server-side client using the service_role key — bypasses Storage RLS.
// Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const CAPTURES_BUCKET = 'captures';

export const supabaseAdmin = url && key ? createClient(url, key) : null;
