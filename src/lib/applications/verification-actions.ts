"use server";

import { redirect } from "next/navigation";
import { clearPass } from "./verification";

// Signing in to verify starts at /apply/verify/start (a route, so it can open in a popup).

/** "Use a different account": forgets the pass so they can verify again. */
export async function forgetApplicantVerification() {
  await clearPass();
  redirect("/apply");
}
