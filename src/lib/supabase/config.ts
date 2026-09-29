// Supabase connection settings. Accepts both the current key names (publishable / secret) and
// the legacy ones (anon / service_role) so either set from the dashboard works.

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function supabaseSecretKey() {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
}

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabasePublishableKey && supabaseSecretKey());
}

/** Public bucket holding document PDFs and member photos. Created by supabase/migrations. */
export const UPLOADS_BUCKET = "uploads";

/** Only Google accounts on this domain can sign in to the portal. */
export const ALLOWED_EMAIL_DOMAIN = "ust.edu.ph";
