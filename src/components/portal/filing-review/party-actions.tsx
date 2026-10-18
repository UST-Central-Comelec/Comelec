"use client";

import { Ban, CirclePause, RotateCcw, Undo2, UserMinus, UserRoundCheck } from "lucide-react";
import { liftPartySanction, makePartyContact, removePartyMember, sanctionParty, withdrawPartyRegistration } from "@/lib/party-portal/review-actions";
import type { PartySanction, PartyStatus } from "@/lib/party-portal/types";
import { ConfirmAction } from "./confirm-action";

/** A member's row: make them the contact person, or remove them. A request to join can be removed. The contact person has neither. */
export function MemberActions({ partyId, memberId, name, status, isContact }: { partyId: string; memberId: string; name: string; status: "requested" | "active"; isContact: boolean }) {
  if (isContact) return null;
  return (
    <span className="fr-row-actions">
      {status === "active" && (
        <ConfirmAction label="Make contact person" icon={<UserRoundCheck size={14} aria-hidden="true" />} title={`Make ${name} the contact person?`}
          confirmLabel="Make contact person" pendingLabel="Changing…" action={() => makePartyContact(partyId, memberId)}>
          They’ll approve who joins and endorse the party’s candidates in the filing portal. The current contact person stays on as a member. The party is notified, and {name} is emailed.
        </ConfirmAction>
      )}
      <ConfirmAction label={status === "requested" ? "Remove request" : "Remove"} icon={<UserMinus size={14} aria-hidden="true" />} buttonClassName="portal-button is-danger-ghost is-small" danger
        title={status === "requested" ? `Remove ${name}’s request to join?` : `Remove ${name} from the party?`}
        note={{ label: "Note to them", required: false, placeholder: "Like: not on the signed roll of members." }}
        confirmLabel={status === "requested" ? "Remove request" : "Remove member"} pendingLabel="Removing…" action={(note) => removePartyMember(partyId, memberId, note)}>
        {status === "requested" ? "They won’t join the party, and they’re emailed." : "They lose access to the party’s documents and are emailed. They can join or register another party while registration is open."}
      </ConfirmAction>
    </span>
  );
}

/** Ends the registration: the name and members are freed, and candidates waiting on its endorsement are told. */
export function WithdrawPartyButton({ partyId, name, members }: { partyId: string; name: string; members: number }) {
  return (
    <ConfirmAction label="Withdraw registration" icon={<Undo2 size={15} aria-hidden="true" />} buttonClassName="portal-button is-danger-ghost" danger
      title={`Withdraw ${name}’s registration?`}
      note={{ label: "Why it’s withdrawn", required: true, placeholder: "Like: the party asked in writing on 20 October, or it was declined and won’t refile." }}
      confirmLabel="Withdraw registration" pendingLabel="Withdrawing…" action={(note) => withdrawPartyRegistration(partyId, note)}>
      Its {members === 1 ? "member is" : `${members} members are`} taken out of the party and emailed, and its name is free for another party. Candidates waiting on its endorsement are told it won’t come. This can’t be undone here.
    </ConfirmAction>
  );
}

/** Suspend (an accredited party) or blacklist it, with a reason; or lift what it has. */
export function SanctionActions({ partyId, name, status, sanction }: { partyId: string; name: string; status: PartyStatus; sanction: PartySanction | null }) {
  if (sanction) {
    const what = sanction === "blacklisted" ? "blacklisting" : "suspension";
    return (
      <div className="fr-sanctions">
        <span>{sanction === "blacklisted" ? "Blacklisted" : "Suspended"}</span>
        <ConfirmAction label={`Lift ${what}`} icon={<RotateCcw size={14} aria-hidden="true" />} title={`Lift the ${what} of ${name}?`}
          note={{ label: "Note to the party", required: false }} confirmLabel={`Lift ${what}`} pendingLabel="Lifting…" action={(note) => liftPartySanction(partyId, note)}>
          The party stands as it did before: {status === "accredited" ? "accredited, able to field candidates" : status === "pending" ? "registering, able to change its documents and take members" : `${status}`}. Its members are notified and emailed.
        </ConfirmAction>
      </div>
    );
  }
  return (
    <div className="fr-sanctions">
      <span>Sanctions</span>
      {status === "accredited" && (
        <ConfirmAction label="Suspend" icon={<CirclePause size={14} aria-hidden="true" />} buttonClassName="portal-button is-danger-ghost is-small" danger title={`Suspend ${name}?`}
          note={{ label: "Why it’s suspended", required: true, placeholder: "Its members read this." }} confirmLabel="Suspend party" pendingLabel="Suspending…" action={(note) => sanctionParty(partyId, "suspended", note)}>
          Until you lift it, the party can’t take members or endorse candidates, and its candidates can’t be qualified. Its accreditation and records stay. Its members are notified and emailed.
        </ConfirmAction>
      )}
      <ConfirmAction label="Blacklist" icon={<Ban size={14} aria-hidden="true" />} buttonClassName="portal-button is-danger-ghost is-small" danger title={`Blacklist ${name}?`}
        note={{ label: "Why it’s blacklisted", required: true, placeholder: "Its members read this." }} confirmLabel="Blacklist party" pendingLabel="Blacklisting…" action={(note) => sanctionParty(partyId, "blacklisted", note)}>
        The party is barred: it can’t take members, endorse or field candidates, or change its documents, and its name can’t be registered again. Its records stay. Its members are notified and emailed. You can lift it later.
      </ConfirmAction>
    </div>
  );
}
