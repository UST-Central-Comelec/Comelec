import "server-only";

import type { Email } from "@/lib/email/send";
import { COMMISSION, button, details, detailsText, divider, escape, greetingName, link, note, paragraph, quote, shell, siteUrl, status, type Details } from "@/lib/email/template";
import { unitName } from "@/lib/party-portal/types";
import { formatSlot } from "@/lib/filing-portal/services";
import { activityKinds, materialKinds, type CampaignActivity, type CampaignMaterial } from "./campaign";

// The email a candidate gets when the unit reviews a campaign material or an activity on their
// campaign schedule (switch "campaign-review", under Services → Email → Automatic).

type Person = { firstName: string; email: string };
type Filed = { college: string; reference: string };

const helpText = "Questions? Reply to this email, or write to comelec@ust.edu.ph.";
const help = note(`Questions? Reply to this email, or write to ${link("mailto:comelec@ust.edu.ph", "comelec@ust.edu.ph")}.`);

export type CampaignReviewed = { kind: "material"; item: CampaignMaterial } | { kind: "activity"; item: CampaignActivity };

export function campaignReviewEmail(person: Person, filed: Filed, reviewed: CampaignReviewed): Email {
  const unit = unitName(filed.college);
  const greeting = `Hi ${greetingName(person.firstName)},`;
  const material = reviewed.kind === "material";
  const outcome = reviewed.item.status;
  const what = material ? `your ${materialKinds[reviewed.item.kind].label.toLowerCase()} “${reviewed.item.title}”` : `“${reviewed.item.title}” on your campaign schedule`;
  const intro = outcome === "approved"
    ? material ? `The ${unit} approved ${what}. Use it only as approved, and only during the campaign period.` : `The ${unit} approved ${what}.`
    : outcome === "changes" ? `The ${unit} asked for changes to ${what}. Send a revised version from the filing portal; don’t use it until it’s approved.`
      : material ? `The ${unit} didn’t approve ${what}, so it can’t be used in your campaign.` : `The ${unit} didn’t approve ${what}, so it can’t go ahead as planned.`;
  const rows: Details = material
    ? [["Filing ID", filed.reference], ["Material", reviewed.item.title], ["Kind", materialKinds[reviewed.item.kind].label]]
    : [["Filing ID", filed.reference], ["Activity", reviewed.item.title], ["Kind", activityKinds[reviewed.item.kind].label], ["When", formatSlot(reviewed.item.startsAt, reviewed.item.endsAt)], ["Where", reviewed.item.venue]];
  const said = reviewed.item.feedback.trim();
  const url = `${siteUrl()}/filing/candidacy/${material ? "materials" : "schedule"}`;
  const label = outcome === "approved" ? "Approved" : outcome === "changes" ? "Changes asked" : "Not approved";
  return {
    to: person.email,
    subject: `${label}: ${reviewed.item.title}`,
    text: [greeting, intro, detailsText(rows), said && `The unit wrote:\n${said}`, `Open the filing portal: ${url}`, helpText, COMMISSION].filter(Boolean).join("\n\n"),
    html: shell({
      eyebrow: ["Campaign", unit, filed.reference].join(" · "),
      title: outcome === "approved" ? `${material ? "Material" : "Activity"} *approved*` : outcome === "changes" ? "Changes *asked*" : `${material ? "Material" : "Activity"} *not approved*`,
      preheader: intro,
      blocks: [...(outcome === "approved" ? [status("Approved", "ok")] : []), paragraph(escape(greeting)), paragraph(escape(intro)), details(rows), ...(said ? [quote(said)] : []), button("Open the filing portal", url), divider(), help],
    }),
  };
}

const at = "2026-10-21T02:00:00.000Z";

export const campaignReviewSample = (college: string | null) => campaignReviewEmail({ firstName: "JUAN PAOLO", email: "juan.delacruz.sci@ust.edu.ph" }, { college: college ?? "", reference: "FC-6R2P-8YDM" }, {
  kind: "material",
  item: { id: "", candidacyId: "", kind: "poster", title: "Classroom poster, week one", width: 8.5, height: 11, placement: "Classroom bulletin boards", link: "", showsParty: false, files: [], status: "changes", feedback: "Leave out the university seal: it can’t be used on campaign materials.", submittedAt: at, reviewedBy: null, reviewedAt: at, createdAt: at, updatedAt: at },
});
