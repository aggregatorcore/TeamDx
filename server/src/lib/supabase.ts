import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Add them to .env for server-side Supabase access."
  );
}

/**
 * Server-side Supabase client with service role key.
 * Bypasses RLS – use only on the server for admin/API operations.
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});
