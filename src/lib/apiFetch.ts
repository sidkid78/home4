import { supabase } from './supabaseClient';

// fetch wrapper that attaches the current Supabase access token so the backend
// can verify identity. Use this for every /v1 call that needs the logged-in user.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
