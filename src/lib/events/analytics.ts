import { affiliationLabels, attendingChoices, requestKinds, sexes, type AffiliationChoice, type RequestKind, type Sex } from "./options";
import type { Registration } from "./registrations";

// What an event's registrations add up to: how many signed up, and how their answers split, for the
// analytics on the event's page in the portal. Everyone counts, whether registered or on the waitlist.

/** One answer and how many gave it. `share` is out of everyone who signed up, from 0 to 1. */
export type Tally = { label: string; count: number; share: number };

export type EventAnalytics = {
  total: number;
  registered: number;
  waitlisted: number;
  /** Registered with a UST account verified through Google. */
  verified: number;
  /** The middle age, or null with nobody who gave one. */
  medianAge: number | null;
  affiliation: Tally[];
  sex: Tally[];
  /** In order, youngest first, without the brackets nobody is in. */
  ages: Tally[];
  /** UST students' colleges and programs, most common first. */
  colleges: Tally[];
  programs: Tally[];
  /** UST faculty and staff's colleges, faculties and offices; others' universities and institutions. */
  offices: Tally[];
  institutions: Tally[];
  attending: Tally[];
  /** The organizations representatives came for. People write the same one in different capitals; they count together. */
  organizations: Tally[];
  /** What was asked for under Logistics, and how many asked. */
  requests: Array<Tally & { kind: RequestKind; approved: number; unavailable: number; pending: number }>;
};

const byCount = (a: Tally, b: Tally) => b.count - a.count || a.label.localeCompare(b.label);

/** Counts `labels`, most common first. Spellings that differ only in capitals or spaces count together, under the one used most. */
function tally(labels: Array<string | null>, total: number): Tally[] {
  const groups = new Map<string, Map<string, number>>();
  for (const raw of labels) {
    const label = raw?.trim().replace(/\s+/g, " ");
    if (!label) continue;
    const key = label.toLowerCase();
    const forms = groups.get(key) ?? new Map<string, number>();
    forms.set(label, (forms.get(label) ?? 0) + 1);
    groups.set(key, forms);
  }
  return [...groups.values()]
    .map((forms) => {
      const count = [...forms.values()].reduce((sum, uses) => sum + uses, 0);
      const label = [...forms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      return { label, count, share: total ? count / total : 0 };
    })
    .sort(byCount);
}

const ageBrackets: Array<[string, number, number]> = [["Under 18", 0, 17], ["18 to 20", 18, 20], ["21 to 24", 21, 24], ["25 to 34", 25, 34], ["35 to 49", 35, 49], ["50 and over", 50, 200]];

export function analyze(registrations: Registration[]): EventAnalytics {
  const total = registrations.length;
  const share = (count: number) => (total ? count / total : 0);
  const count = (matches: (registration: Registration) => boolean) => registrations.filter(matches).length;
  const inOrder = <T extends string>(keys: readonly T[], label: (key: T) => string, matches: (registration: Registration, key: T) => boolean) =>
    keys.map((key) => ({ label: label(key), count: count((registration) => matches(registration, key)) })).filter((item) => item.count > 0).map((item) => ({ ...item, share: share(item.count) }));

  const ages = registrations.map((registration) => registration.age).filter((age): age is number => age !== null).sort((a, b) => a - b);

  return {
    total,
    registered: count((registration) => registration.status === "registered"),
    waitlisted: count((registration) => registration.status === "waitlisted"),
    verified: count((registration) => registration.verified),
    medianAge: ages.length ? ages[Math.floor((ages.length - 1) / 2)] : null,
    affiliation: inOrder(Object.keys(affiliationLabels) as AffiliationChoice[], (key) => affiliationLabels[key], (registration, key) => registration.affiliation === key),
    sex: inOrder(Object.keys(sexes) as Sex[], (key) => sexes[key], (registration, key) => registration.sex === key),
    ages: ageBrackets
      .map(([label, from, to]) => ({ label, count: ages.filter((age) => age >= from && age <= to).length }))
      .filter((item) => item.count > 0)
      .map((item) => ({ ...item, share: share(item.count) })),
    colleges: tally(registrations.filter((registration) => registration.affiliation === "ust-student").map((registration) => registration.college), total),
    programs: tally(registrations.filter((registration) => registration.affiliation === "ust-student").map((registration) => registration.program), total),
    offices: tally(registrations.filter((registration) => registration.affiliation === "ust-staff").map((registration) => registration.office), total),
    institutions: tally(registrations.filter((registration) => registration.affiliation === "other-institution" || registration.affiliation === "independent").map((registration) => (registration.institution && !/^n\/?a$/i.test(registration.institution.trim()) ? registration.institution : null)), total),
    attending: inOrder(Object.keys(attendingChoices) as Array<keyof typeof attendingChoices>, (key) => attendingChoices[key], (registration, key) => registration.attendingAs === key),
    organizations: tally(registrations.filter((registration) => registration.attendingAs === "representative").map((registration) => registration.organizationName), total),
    requests: (Object.keys(requestKinds) as RequestKind[])
      .map((kind) => {
        const asked = registrations.map((registration) => registration.requests[kind]).filter((entry) => entry !== undefined);
        return {
          kind,
          label: requestKinds[kind].short,
          count: asked.length,
          share: share(asked.length),
          approved: asked.filter((entry) => entry.status === "approved").length,
          unavailable: asked.filter((entry) => (entry.status === "unavailable" || entry.status === "revoked")).length,
          pending: asked.filter((entry) => entry.status === "pending").length,
        };
      })
      .filter((item) => item.count > 0),
  };
}
