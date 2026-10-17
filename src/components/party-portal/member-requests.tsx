"use client";

import { useEffect, useTransition } from "react";
import { Check, CircleSlash } from "lucide-react";
import { NOTICES_READ_EVENT } from "@/components/filing-portal/shell";
import { DeleteButton } from "@/components/portal/delete-button";
import { toast } from "@/components/portal/toast";
import { answerEndorsement } from "@/lib/candidacy/actions";
import { markFilingNoticesRead } from "@/lib/filing-portal/actions";
import { answerJoinRequest } from "@/lib/party-portal/actions";

type Result = { ok?: string; error?: string };
const report = (result: Result) => { if (result.error) toast(result.error, "error"); else if (result.ok) toast(result.ok); };

/** Approve, or decline in two steps: the contact person's answer, to someone asking to join or a member asking for the party's endorsement. */
function AnswerButtons({ name, approveLabel, approvingLabel, onAnswer }: { name: string; approveLabel: string; approvingLabel: string; onAnswer: (approve: boolean) => Promise<Result> }) {
  const [pending, startTransition] = useTransition();
  return (
    <span className="pp-request-actions">
      <DeleteButton label="Decline" prompt={`Decline ${name}?`} confirmLabel="Yes, decline" pendingLabel="Declining…" tone="quiet" animatedIcon={false} icon={<CircleSlash size={14} aria-hidden="true" />} action={async () => report(await onAnswer(false))} />
      <button type="button" className="portal-button is-ok is-small" disabled={pending} onClick={() => startTransition(async () => report(await onAnswer(true)))}><Check size={14} aria-hidden="true" />{pending ? approvingLabel : approveLabel}</button>
    </span>
  );
}

export function JoinRequestActions({ memberId, name }: { memberId: string; name: string }) {
  return <AnswerButtons name={name} approveLabel="Approve" approvingLabel="Approving…" onAnswer={(approve) => answerJoinRequest(memberId, approve)} />;
}

export function EndorsementActions({ candidacyId, name }: { candidacyId: string; name: string }) {
  return <AnswerButtons name={name} approveLabel="Endorse" approvingLabel="Endorsing…" onAnswer={(endorse) => answerEndorsement(candidacyId, endorse)} />;
}

/** Opening Notifications marks them read, so the sidebar's count goes. */
export function MarkNoticesRead({ unread }: { unread: number }) {
  useEffect(() => {
    if (unread > 0) void markFilingNoticesRead().then(() => window.dispatchEvent(new Event(NOTICES_READ_EVENT)));
  }, [unread]);
  return null;
}
