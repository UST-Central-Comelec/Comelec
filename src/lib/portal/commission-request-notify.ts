import "server-only";
import { emailUnit, later, sendAutomatic } from "@/lib/notifications/notify";
import { button, details, detailsText, escape, paragraph, shell, siteUrl } from "@/lib/email/template";
import { unitName } from "@/lib/party-portal/types";
import { formatSlot, requestStatusLabel } from "@/lib/filing-portal/services";
import type { CommissionRequest } from "./commission-requests";

export function notifyCommissionRequest(request: CommissionRequest, answer = false) {
  const rows: Array<[string, string]> = [["Reference", request.reference], ["Type", request.type_name], ["From", request.sender_name], ["Unit", unitName(request.college)], ["When", formatSlot(request.starts_at, request.ends_at)], ["Where", request.venue]];
  const title = answer ? `${requestStatusLabel[request.status]}: ${request.subject}` : `New request: ${request.subject}`;
  const url = `${siteUrl()}/portal/request/internal/${request.id}`;
  const email = (to: string[]) => ({ to: to.join(", "), subject: `${title} (${request.reference})`, text: [title, detailsText(rows), answer ? request.response : request.details, url].filter(Boolean).join("\n\n"), html: shell({ eyebrow: "Requests", title: answer ? "Your request has an *answer*" : "A unit has sent a *request*", preheader: title, blocks: [paragraph(escape(title)), details(rows), paragraph(escape(answer ? request.response : request.details)), button("Open the request", url)] }), replyTo: answer ? undefined : { name: request.sender_name, address: request.sender_email } });
  later(() => answer ? sendAutomatic("service-answer", () => email([request.sender_email])) : emailUnit("service-notice", { unit: "local", college: request.college }, email));
}
