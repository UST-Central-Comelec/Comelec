import type { EditorDefinition } from "@/lib/events/form-editor";
import type { EvaluationSettings } from "@/lib/events/evaluation";

export type FormViewDraft =
  | { kind: "registration"; name: string; eventId: string }
  | { kind: "rsvp"; name: string; eventId: string; definition: EditorDefinition }
  | { kind: "evaluation"; name: string; eventId: string; settings: EvaluationSettings }
  | { kind: "survey"; name: string; description: string; definition: EditorDefinition };

const PREFIX = "comelec:form-view:";
const MAX_AGE = 30 * 60 * 1000;

/** Each tab gets its own snapshot; drafts are never sent to a server. */
export function storeFormView(storage: Storage, draft: FormViewDraft, token: string, now = Date.now()): string {
  for (let index = storage.length - 1; index >= 0; index--) {
    const key = storage.key(index);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      const item = JSON.parse(storage.getItem(key) ?? "null");
      if (!item || now - item.at > MAX_AGE) storage.removeItem(key);
    } catch { storage.removeItem(key); }
  }
  storage.setItem(PREFIX + token, JSON.stringify({ at: now, draft }));
  return `/forms/preview?draft=${encodeURIComponent(token)}`;
}

export function readFormView(raw: string | null, now = Date.now()): FormViewDraft | null {
  try {
    const item = JSON.parse(raw ?? "null");
    if (!item || !Number.isFinite(item.at) || now - item.at > MAX_AGE) return null;
    const draft = item.draft as FormViewDraft;
    if (!draft || typeof draft.name !== "string") return null;
    if (draft.kind === "registration") return typeof draft.eventId === "string" ? draft : null;
    if (draft.kind === "evaluation") return draft.settings && typeof draft.eventId === "string" ? draft : null;
    if (draft.kind !== "rsvp" && draft.kind !== "survey") return null;
    return Array.isArray(draft.definition?.steps) && draft.definition.steps.length ? draft : null;
  } catch { return null; }
}

export function formViewKey(token: string): string {
  return PREFIX + token;
}
