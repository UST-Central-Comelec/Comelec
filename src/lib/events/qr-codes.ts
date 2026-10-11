import "server-only";
import { randomInt } from "node:crypto";
import { siteUrl } from "@/lib/email/template";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { rsvpFormPath } from "./rsvp";

/*
 * Every event form has its own QR code: a short link, /q/<token>, that forwards to the form. Making
 * a new code replaces the token, so a printed old code stops working. Tokens are made when an
 * event's editor first opens (or its QR panel does).
 */
export const qrForms = ["registration", "rsvp", "evaluation"] as const;
export type QrForm = (typeof qrForms)[number];
export const isQrForm = (value: unknown): value is QrForm => typeof value === "string" && (qrForms as readonly string[]).includes(value);
const TABLE = "event_form_qr_codes";
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export const unavailable = "QR codes need supabase/migrations/0059_event_form_qr_codes.sql. Run it in the Supabase SQL Editor.";

const newToken = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
export const formPath = (eventId: string, form: QrForm) => form === "registration" ? `/events/${eventId}/register` : form === "rsvp" ? rsvpFormPath(eventId) : `/events/${eventId}/evaluate`;
export const qrUrl = (token: string) => `${siteUrl()}/q/${token}`;

/** Each form's token, making any that are missing. */
export async function ensureQrCodes(eventId: string): Promise<Partial<Record<QrForm, string>>> {
  if (!isSupabaseConfigured()) return {};
  const client = createAdminClient();
  const { data, error } = await client.from(TABLE).select("form, token").eq("event_id", eventId);
  if (error) throw new Error(unavailable);
  const tokens: Partial<Record<QrForm, string>> = Object.fromEntries((data ?? []).map(row => [row.form, row.token]));
  const missing = qrForms.filter(form => !tokens[form]);
  if (missing.length) {
    const rows = missing.map(form => ({ event_id: eventId, form, token: newToken() }));
    // A code made by someone else at the same moment wins; it's read back below.
    await client.from(TABLE).upsert(rows, { onConflict: "event_id,form", ignoreDuplicates: true });
    const again = await client.from(TABLE).select("form, token").eq("event_id", eventId);
    if (again.error) throw new Error(unavailable);
    for (const row of again.data ?? []) tokens[row.form as QrForm] = row.token;
  }
  return tokens;
}

/** A new token for one form; the old one stops forwarding at once. */
export async function replaceQrCode(eventId: string, form: QrForm) {
  const token = newToken();
  const { error } = await createAdminClient().from(TABLE).upsert({ event_id: eventId, form, token, created_at: new Date().toISOString() }, { onConflict: "event_id,form" });
  if (error) throw new Error(unavailable);
  return token;
}

/** Where a code forwards to, or null when it's been replaced or never existed. */
export async function findQrTarget(token: string) {
  if (!/^[A-Za-z0-9]{10}$/.test(token) || !isSupabaseConfigured()) return null;
  const { data, error } = await createAdminClient().from(TABLE).select("event_id, form").eq("token", token).maybeSingle();
  if (error || !data || !isQrForm(data.form)) return null;
  return formPath(data.event_id, data.form);
}
