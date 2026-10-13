"use client";

import { MailCheckIcon } from "@/components/lucide-animated/mail-check";
import { DeleteIcon, SaveIcon } from "@/components/action-icons";

const icons = { resend: MailCheckIcon, update: SaveIcon, remove: DeleteIcon };

/** All review actions share the whole-button animation policy. */
export function ReviewActionIcon({ kind }: { kind: keyof typeof icons; disabled?: boolean }) {
  const Icon = icons[kind];
  return <Icon size={15} aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0 }} />;
}
