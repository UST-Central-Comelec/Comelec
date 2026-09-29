import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { supabasePublishableKey, supabaseSecretKey, supabaseUrl } from "./config";

/**
 * Supabase client acting as the signed-in visitor (reads their session from cookies).
 * Use for sign-in, sign-out and checking who is signed in — not for content queries.
 */
export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; src/proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Server-only client with the secret key. It bypasses Row Level Security, so every caller must
 * check permissions first (portal actions do, via requirePortalUser / requireExecutive).
 */
export function createAdminClient() {
  return createClient(supabaseUrl, supabaseSecretKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
