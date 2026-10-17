import { z } from "zod";
import { registrationStatuses, type RegistrationStatus } from "./options";

export const deploymentValuesSchema = z.object({
  published: z.boolean(),
  registrationStatus: z.enum(Object.keys(registrationStatuses) as [RegistrationStatus, ...RegistrationStatus[]]),
  minimumRegistrants: z.string().max(12), maximumRegistrants: z.string().max(12),
  requireGoogle: z.boolean(), rsvpEnabled: z.boolean(), rsvpGoogle: z.boolean(),
  evaluationEnabled: z.boolean(), evaluationGoogle: z.boolean(), allowAnonymous: z.boolean(),
});
export type DeploymentValues = z.infer<typeof deploymentValuesSchema>;
export type PendingDeployment = { values: DeploymentValues; version: string; applyAt: string; error: string | null };

export function deploymentFormData(values: DeploymentValues, clientId: string, revision: number): FormData {
  const form = new FormData();
  form.set("publicationStatus", values.published ? "published" : "unpublished");
  form.set("registrationStatus", values.registrationStatus);
  form.set("minimumRegistrants", values.minimumRegistrants);
  form.set("maximumRegistrants", values.maximumRegistrants);
  for (const name of ["googleSetting", "rsvpGoogleSetting", "evaluationGoogleSetting"]) form.set(name, "on");
  const flags = { googleEnabled: values.requireGoogle, rsvpEnabled: values.rsvpEnabled, rsvpGoogleEnabled: values.rsvpGoogle, evaluationEnabled: values.evaluationEnabled, evaluationGoogleEnabled: values.evaluationGoogle, allowAnonymous: values.allowAnonymous };
  for (const [name, checked] of Object.entries(flags)) if (checked) form.set(name, "on");
  form.set("clientId", clientId);
  form.set("revision", String(revision));
  return form;
}
