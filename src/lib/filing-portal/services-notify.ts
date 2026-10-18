import "server-only";

import { emailUnit, later, sendAutomatic } from "@/lib/notifications/notify";
import { petitionSubmitted } from "@/lib/petitions/notify";
import { unitName } from "@/lib/party-portal/types";
import { addAccountNotice } from "./accounts";
import { formatSlot, petitionStatusLabel, petitionTypes, requestKinds, type FilingRequest, type Petition, type PetitionStatus } from "./services";
import { petitionUpdateEmail, serviceAnswerEmail, serviceNoticeEmail } from "./services-emails";
import { fullName, type PublicAccount } from "./types";

// What happens around the filing portal's Services: a line in the filer's Announcements, and the
// email that goes with it, sent once the response has gone. The unit is emailed about what's new.

const firstName = (person: { firstName: string }) => person.firstName.split(" ")[0] || person.firstName;
const concernOf = (college: string) => (college ? { unit: "local" as const, college } : { unit: "central" as const });

/** A consultation or a commissioner was asked for: the filer's receipt in Announcements, and the unit's email. */
export async function noticeRequestMade(request: FilingRequest, filer: PublicAccount) {
  const noun = requestKinds[request.kind].noun;
  await addAccountNotice({ accountId: filer.id, kind: `${request.kind}-requested`, title: `Your ${noun} was sent to the ${unitName(request.college)}`, body: `${request.reference} · ${request.subject} · ${formatSlot(request.startsAt, request.endsAt)}. The unit confirms it with a time and a place, or tells you why it can’t.`, href: requestKinds[request.kind].href, actor: "You" });
  later(() => emailUnit("service-notice", concernOf(request.college), (to) => serviceNoticeEmail(to, request, { name: fullName(filer), email: filer.email })));
}

/** The unit confirmed or declined a request, or marked it done (no email for that). */
export async function noticeRequestAnswered(request: FilingRequest, filer: PublicAccount) {
  const noun = requestKinds[request.kind].noun;
  const unit = unitName(request.college);
  const title = request.status === "confirmed" ? `Your ${noun} is confirmed` : request.status === "declined" ? `Your ${noun} was declined` : `Your ${noun} is marked done`;
  const when = request.status === "confirmed" ? `${formatSlot(request.confirmedStart ?? request.startsAt, request.confirmedEnd ?? request.endsAt)}${request.location ? ` · ${request.location}` : ""}${request.assigned ? ` · ${request.assigned}` : ""}` : "";
  await addAccountNotice({ accountId: filer.id, kind: `${request.kind}-${request.status}`, title: `${title} (${request.reference})`, body: [when, request.response].filter(Boolean).join("\n"), href: requestKinds[request.kind].href, actor: unit });
  if (request.status !== "done") later(() => sendAutomatic("service-answer", () => serviceAnswerEmail({ firstName: firstName(filer), email: filer.email }, request)));
}

/** A petition was filed: the filer's receipt (in Announcements and by email), and the unit's notice. */
export async function noticePetitionFiled(petition: Petition, filer: PublicAccount) {
  const type = petitionTypes[petition.type].label;
  await addAccountNotice({ accountId: filer.id, kind: "petition-filed", title: `Your ${type.toLowerCase()} was filed with the ${unitName(petition.college)}`, body: `${petition.reference} · ${petition.subject}. The unit dockets it, or tells you why it won’t.`, href: "/filing/services/petition", actor: "You" });
  petitionSubmitted({
    referenceCode: petition.reference, type, subject: petition.subject, concern: concernOf(petition.college),
    submitter: { name: fullName(filer), firstName: firstName(filer), email: filer.email }, submittedAt: petition.createdAt, statement: petition.statement,
  }, [{ title: "Your petition", rows: [["Type", type], ["Against", petition.respondent || "No one in particular"], ["What happened", petition.statement], ["What you ask", petition.relief || "Not given"], ["Evidence", petition.files.length ? petition.files.map((file) => file.name).join(", ") : "None attached"]] }]);
}

/** The unit docketed, resolved, dismissed or reopened a petition. */
export async function noticePetitionMoved(petition: Petition, filer: PublicAccount, status: Exclude<PetitionStatus, "filed" | "withdrawn">) {
  await addAccountNotice({ accountId: filer.id, kind: `petition-${status}`, title: `${petitionStatusLabel[status].split(",")[0]}: ${petition.subject} (${petition.reference})`, body: petition.remarks, href: "/filing/services/petition", actor: unitName(petition.college) });
  later(() => sendAutomatic("petition-update", () => petitionUpdateEmail({ firstName: firstName(filer), email: filer.email }, petition, status)));
}
