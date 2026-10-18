import type { Metadata } from "next";
import { PetitionWorkspace } from "@/components/filing-portal/petition-workspace";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { unitName } from "@/lib/party-portal/types";
import { serviceChoices } from "@/lib/filing-portal/service-pages";
import { isServicesMissing, listAccountPetitions } from "@/lib/filing-portal/services-store";
import { requireFilingAccount } from "@/lib/filing-portal/session";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "File a petition" };

/** Services → File a petition: a full-width form and a records tracker. */
export default async function FilingPetitionPage() {
  const filing = await requireFilingAccount();
  const [choices, petitions] = await Promise.all([serviceChoices(filing), settle(listAccountPetitions(filing.account.id))]);
  const list = petitions.value ?? [];
  const open = list.filter((petition) => petition.status === "filed" || petition.status === "docketed").length;

  return (
    <main className="portal-page is-wide">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Services · File a petition</p>
          <TitleWithInfo info="File a qualification contest, a nuisance candidate, an election protest, an election or campaign offense, a complaint against a party, or another petition, with its evidence. The unit dockets it and asks whoever it’s against to answer in writing within five school days, then decides within five school days of that answer (Elections Code, Article XII). You get a receipt by email, and you can withdraw it until it’s decided.">File a petition</TitleWithInfo>
          <p className="portal-muted">{open ? `${open} being heard` : list.length ? `${list.length} filed so far` : "Nothing filed yet"}</p>
        </div>
      </header>
      {petitions.error ? (
        <p className="portal-form-error" role="alert">{isServicesMissing(petitions.error) ? "Petitions aren’t set up yet. Try again later, or write to comelec@ust.edu.ph." : "Your petitions couldn’t be loaded. Reload the page to try again."}</p>
      ) : (
        <PetitionWorkspace units={choices.units} draftKey={`petition:${filing.account.id}`} petitions={list} unitNames={{ ...choices.unitNames, ...Object.fromEntries(list.map((petition) => [petition.college, unitName(petition.college)])) }} />
      )}
    </main>
  );
}
