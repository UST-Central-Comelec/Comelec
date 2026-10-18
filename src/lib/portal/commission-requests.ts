import { z } from "zod";
import type { PortalUser } from "@/lib/auth/session";

export type CommissionRequestType = { id: string; name: string; description: string; enabled: boolean; updated_at: string };
export type CommissionRequest = {
  id: string; reference: string; batch_id: string; type_id: string; type_name: string;
  sender_email: string; sender_name: string; sender_college: string | null; college: string;
  subject: string; details: string; starts_at: string; ends_at: string; mode: "in-person" | "online"; venue: string;
  status: "requested" | "confirmed" | "declined" | "done"; response: string; handled_by: string | null; handled_at: string | null;
  created_at: string; updated_at: string;
};
export const requestTypeSchema = z.object({ name: z.string().trim().min(1, "Enter a type name.").max(100), description: z.string().trim().max(1000), enabled: z.boolean() });
export const commissionRequestSchema = z.object({
  type: z.string().uuid("Choose a request type."), recipient: z.string().min(1, "Choose a Local unit."),
  subject: z.string().trim().min(1, "Enter a subject.").max(200), details: z.string().trim().min(1, "Describe your request.").max(4000),
  mode: z.enum(["in-person", "online"]), venue: z.string().trim().min(1, "Enter a venue or meeting link.").max(300),
  date: z.iso.date("Choose a valid date."), start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a start time."), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose an end time."),
  submission: z.string().uuid("Reload the form and try again."),
});
export const canReadCommissionRequest = (user: Pick<PortalUser, "affiliation" | "college" | "email">, request: CommissionRequest) =>
  user.affiliation !== "local" || request.college === user.college || request.sender_email === user.email;
export const canAnswerCommissionRequest = (user: Pick<PortalUser, "affiliation" | "college" | "readOnly">, request: CommissionRequest) =>
  !user.readOnly && (user.affiliation === "central" || (user.affiliation === "local" && user.college === request.college));
