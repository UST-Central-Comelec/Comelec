import { z } from "zod";
import { deploymentFormData, deploymentValuesSchema } from "@/lib/events/deployment";
import { discardEventDeployment, saveEventDeployment } from "@/lib/portal/event-actions";

const payload = z.union([
  z.object({ values: deploymentValuesSchema, clientId: z.uuid(), revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }),
  z.object({ cancelVersion: z.uuid() }),
]);
const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Keepalive requests survive navigating away or closing the tab. Authorization stays in the actions. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Use the Deployment page to change these settings." }, 403);
  if (!request.body) return reply({ error: "The settings are missing." }, 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) { await reader.cancel(); return reply({ error: "The settings are too large." }, 413); }
    chunks.push(new Uint8Array(value));
  }
  let body: unknown;
  try { body = JSON.parse(await new Blob(chunks).text()); }
  catch { return reply({ error: "Couldn’t read the settings. Try again." }, 400); }
  const parsed = payload.safeParse(body);
  if (!parsed.success) return reply({ error: "Check the deployment settings and try again." }, 400);
  const { id } = await params;
  const result = "cancelVersion" in parsed.data
    ? await discardEventDeployment(id, parsed.data.cancelVersion)
    : await saveEventDeployment(id, {}, deploymentFormData(parsed.data.values, parsed.data.clientId, parsed.data.revision));
  return reply(result);
}
