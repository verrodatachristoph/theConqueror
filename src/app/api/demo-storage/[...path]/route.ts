import { readFileSync } from "node:fs";
import { demoMode, demoObjectFile } from "@/lib/supabase/demo";
import { sniffImage } from "@/lib/image-sniff";

export const dynamic = "force-dynamic";

/** Serves demo-mode storage objects in place of Supabase signed URLs. Dev only. */
export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!demoMode()) return new Response("Not found", { status: 404 });
  const [bucket, ...rest] = (await ctx.params).path;
  const file = bucket && rest.length ? demoObjectFile(bucket, rest.map(decodeURIComponent).join("/")) : null;
  if (!file) return new Response("Not found", { status: 404 });
  const bytes = readFileSync(file);
  return new Response(bytes, {
    headers: {
      "content-type": sniffImage(new Uint8Array(bytes))?.type ?? "application/octet-stream",
      "cache-control": "private, max-age=3600",
    },
  });
}
