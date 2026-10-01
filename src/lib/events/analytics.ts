import { yearLevels } from "@/lib/applications/options";
import { interestLevels, sexes, type Sex } from "./options";
import type { Registration } from "./registrations";

// What an event's registrations add up to: how many signed up, and how their answers split, for the
// analytics on the event's page in the portal. Everyone counts, whether registered or on the waitlist.

/** One answer and how many gave it. `share` is out of everyone who signed up, from 0 to 1. */
export type Tally = { label: string; count: number; share: number };

export type EventAnalytics = {
  total: number;
  registered: number;
  waitlisted: number;
  /** The mean of the interest answers, 1 to 5; null with nobody signed up. */
  averageInterest: number | null;
  /** All five levels, lowest first, including the ones nobody picked. */
  interest: Array<Tally & { value: number }>;
  sex: Tally[];
  /** In the form's order (1st year first), without the levels nobody is in. */
  yearLevels: Tally[];
  /** The rest are most common first, then by name. */
  colleges: Tally[];
  programs: Tally[];
  /** Someone in several organizations counts once for each, so the shares add up to more than everyone. */
  organizations: Tally[];
  /** How many listed no organization. */
  unaffiliated: number;
};

const byCount = (a: Tally, b: Tally) => b.count - a.count || a.label.localeCompare(b.label);

/** Counts `labels`, most common first. */
function tally(labels: string[], total: number): Tally[] {
  const counts = new Map<string, number>();
  for (const label of labels) counts.set(label, (counts.get(label) ?? 0) + 1);
  return [...counts].map(([label, count]) => ({ label, count, share: total ? count / total : 0 })).sort(byCount);
}

export function analyze(registrations: Registration[]): EventAnalytics {
  const total = registrations.length;
  const share = (count: number) => (total ? count / total : 0);
  const count = (matches: (registration: Registration) => boolean) => registrations.filter(matches).length;

  // People write the same organization in different capitals; they count together, under the spelling used most.
  const spellings = new Map<string, Map<string, number>>();
  for (const registration of registrations) {
    for (const name of registration.organizations) {
      const key = name.trim().toLowerCase();
      const forms = spellings.get(key) ?? new Map<string, number>();
      forms.set(name.trim(), (forms.get(name.trim()) ?? 0) + 1);
      spellings.set(key, forms);
    }
  }
  const organizations = [...spellings.values()]
    .map((forms) => {
      const members = [...forms.values()].reduce((sum, uses) => sum + uses, 0);
      const label = [...forms].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      return { label, count: members, share: share(members) };
    })
    .sort(byCount);

  return {
    total,
    registered: count((registration) => registration.status === "registered"),
    waitlisted: count((registration) => registration.status === "waitlisted"),
    averageInterest: total ? registrations.reduce((sum, registration) => sum + registration.interest, 0) / total : null,
    interest: interestLevels.map(({ value, label }) => {
      const picked = count((registration) => registration.interest === value);
      return { value, label, count: picked, share: share(picked) };
    }),
    sex: (Object.keys(sexes) as Sex[])
      .map((sex) => ({ label: sexes[sex], count: count((registration) => registration.sex === sex) }))
      .filter((item) => item.count > 0)
      .map((item) => ({ ...item, share: share(item.count) })),
    yearLevels: (Object.keys(yearLevels) as Array<keyof typeof yearLevels>)
      .map((level) => ({ label: yearLevels[level], count: count((registration) => registration.yearLevel === level) }))
      .filter((item) => item.count > 0)
      .map((item) => ({ ...item, share: share(item.count) })),
    colleges: tally(registrations.map((registration) => registration.college), total),
    programs: tally(registrations.map((registration) => registration.program), total),
    organizations,
    unaffiliated: count((registration) => registration.organizations.length === 0),
  };
}
