"use server";

import { unstable_rethrow } from "next/navigation";
import { requireEditor } from "@/lib/auth/session";
import { canManageEvent } from "@/lib/events/access";
import { getEvent } from "@/lib/events/queries";
import { ensureQrCodes, isQrForm, qrUrl, replaceQrCode, unavailable } from "@/lib/events/qr-codes";

export type QrResult = { url?: string; error?: string };

async function managed(eventId: string) {
  const user = await requireEditor("events");
  const event = await getEvent(eventId);
  return event && canManageEvent(user, event) ? event : null;
}

/** The QR address for one of an event's forms, made on first use. */
export async function getFormQr(eventId: string, form: string): Promise<QrResult> {
  if (!isQrForm(form)) return { error: "Choose one of the event’s forms." };
  try {
    if (!await managed(eventId)) return { error: "You don’t have permission to manage this event’s QR codes." };
    const token = (await ensureQrCodes(eventId))[form];
    return token ? { url: qrUrl(token) } : { error: unavailable };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : unavailable };
  }
}

/** Replaces a form's QR code; the old one stops working. */
export async function regenerateFormQr(eventId: string, form: string): Promise<QrResult> {
  if (!isQrForm(form)) return { error: "Choose one of the event’s forms." };
  try {
    if (!await managed(eventId)) return { error: "You don’t have permission to manage this event’s QR codes." };
    return { url: qrUrl(await replaceQrCode(eventId, form)) };
  } catch (error) {
    unstable_rethrow(error);
    return { error: error instanceof Error ? error.message : unavailable };
  }
}
