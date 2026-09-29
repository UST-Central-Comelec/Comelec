"use server";

import { text, type FormState } from "@/lib/portal/form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";
import { divisions, type DivisionId } from "./options";
import { applicationFields, checkFields, needsPortfolio, readApplication, type ApplicationField } from "./schema";
import { getSlots } from "./slots";

export type ApplicationState = (FormState & { submitted?: boolean }) | undefined;

const allFields = Object.keys(applicationFields.shape) as ApplicationField[];

export async function submitApplication(_state: ApplicationState, formData: FormData): Promise<ApplicationState> {
  // Hidden field that people never see. Bots that fill it get a normal-looking success.
  if (text(formData, "website")) return { submitted: true };

  if (!isSupabaseConfigured()) return { error: "Applications aren’t being accepted online right now. Please email comelec@ust.edu.ph." };

  const values = readApplication(formData);
  const fieldErrors = checkFields(values, allFields, await getSlots());
  if (Object.keys(fieldErrors).length) return { error: "Check the highlighted fields.", fieldErrors };

  const data = applicationFields.parse(values);
  const division = divisions[data.division as DivisionId];
  const facebookUrl = /^https?:\/\//i.test(data.facebookUrl) ? data.facebookUrl : `https://${data.facebookUrl}`;

  const { error } = await createAdminClient().from("applications").insert({
    last_name: data.lastName.toUpperCase(),
    first_name: data.firstName.toUpperCase(),
    middle_initial: data.middleInitial.toUpperCase(),
    student_number: data.studentNumber,
    contact_number: data.contactNumber.replace(/[\s-]/g, ""),
    email: data.email,
    facebook_url: facebookUrl,
    college: data.college,
    program: data.program,
    year_level: data.yearLevel,
    preferred_body: data.preferredBody,
    division: division.label,
    position: (division.positions as Record<string, string>)[data.position],
    position_id: data.position,
    cv_url: data.cvUrl,
    endorsement_url: data.endorsementUrl || null,
    portfolio_url: needsPortfolio(data.division) ? data.portfolioUrl : null,
    consent: data.consent,
  });

  if (error?.code === "23505") {
    return { error: "We already have an application from this email for this election year.", fieldErrors: { email: "This email has already applied this year." } };
  }
  if (error) {
    console.error("Couldn’t save application:", error.message);
    return { error: "Something went wrong saving your application. Please try again, or email comelec@ust.edu.ph." };
  }

  return { submitted: true };
}
