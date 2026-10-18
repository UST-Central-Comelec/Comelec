import { Clock } from "lucide-react";
import type { Candidacy } from "@/lib/candidacy/types";
import { unitName } from "@/lib/party-portal/types";

/** Materials and the schedule open once the candidate is on the official list: what to say until then. */
export function CampaignClosed({ candidacy }: { candidacy: Candidacy }) {
  const unit = unitName(candidacy.college);
  return (
    <section className="portal-card pp-waiting">
      <Clock size={22} aria-hidden="true" />
      <div>
        <h2>{candidacy.status === "pending" ? "Opens once you’re qualified" : candidacy.status === "disqualified" ? "Closed: you weren’t qualified" : "Closed"}</h2>
        <p className="portal-muted">
          {candidacy.status === "pending"
            ? `The campaign starts the day after the ${unit} releases its official list of candidates (Elections Code, Article VII, Section 1). Once it qualifies you, send your materials and schedule here for approval. No campaign material can be used before then.`
            : `Only candidates on the ${unit}’s official list campaign. Write to the unit if you think this is a mistake.`}
        </p>
      </div>
    </section>
  );
}
