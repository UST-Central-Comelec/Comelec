import { z } from "zod";

// Each unit's elective positions, in order: what a candidate runs for. Edited under Administrative →
// Database → Elective positions (public.elective_positions); a unit that hasn't saved its own starts
// with the Executive Board the CSC Constitution names (Article VI, Section 2), which a Local Student
// Council follows unless its own constitution says otherwise. Free of server-only imports.

export type ElectivePosition = { id: string; name: string };
/** By unit: "" is the Central Student Council's Executive Board, a Local unit its college's name. */
export type ElectivePositions = Record<string, ElectivePosition[]>;

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "position";

export const EXECUTIVE_BOARD = ["President", "Vice-President", "Secretary", "Treasurer", "Auditor", "Public Relations Officer"] as const;

export const defaultElectivePositions = (): ElectivePosition[] => EXECUTIVE_BOARD.map((name) => ({ id: `e-${slug(name)}`, name }));

/** A new position's id, from its name, unlike any in `taken`. */
export function electiveIdFor(name: string, taken: ReadonlySet<string>) {
  const base = `e-${slug(name)}`;
  let id = base;
  for (let count = 2; taken.has(id); count += 1) id = `${base}-${count}`;
  return id;
}

const cleanName = (value: string) => value.replace(/\s+/g, " ").trim();

export const electivePositionsSchema = z.array(z.object({
  id: z.string().regex(/^[\w-]{1,80}$/, "Unknown item."),
  name: z.string().transform(cleanName).pipe(z.string().min(1, "Enter the position name.").max(100, "Keep the position name within 100 characters.")),
})).min(1, "Keep at least one position.").max(40, "Keep up to 40 positions.").superRefine((items, context) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    const key = item.name.toLowerCase();
    if (seen.has(key)) context.addIssue({ code: "custom", path: [index, "name"], message: "This position is already listed." });
    seen.add(key);
  });
});
