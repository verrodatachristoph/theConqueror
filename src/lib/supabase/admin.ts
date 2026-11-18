import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createDemoClient, demoMode } from "@/lib/supabase/demo";

type AdminClient = ReturnType<typeof createClient<Database>>;

/**
 * Service-role Supabase client — bypasses RLS. SERVER-ONLY.
 * Never import this into a Client Component or expose the key to the browser.
 * Used by server actions and local DB scripts.
 *
 * Under `next dev` with DEV_DEMO=1 it returns the in-memory demo client instead
 * (src/lib/supabase/demo.ts), so the app runs without a Supabase project.
 */
export function createAdminClient(): AdminClient {
  if (demoMode()) return createDemoClient() as unknown as AdminClient;
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
