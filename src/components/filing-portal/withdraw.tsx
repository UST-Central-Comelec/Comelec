"use client";

import { unstable_rethrow } from "next/navigation";
import { CircleSlash } from "lucide-react";
import { DeleteButton } from "@/components/portal/delete-button";
import { toast } from "@/components/portal/toast";
import { withdrawMyCandidacy } from "@/lib/candidacy/actions";

/** Withdraws the candidacy in two steps; the action takes them to the dashboard. */
export function WithdrawCandidacy() {
  return <DeleteButton label="Withdraw my candidacy" prompt="Withdraw your candidacy?" confirmLabel="Yes, withdraw" pendingLabel="Withdrawing…" animatedIcon={false} icon={<CircleSlash size={15} aria-hidden="true" />} action={async () => {
    try {
      const result = await withdrawMyCandidacy();
      if (result.error) toast(result.error, "error");
    } catch (error) {
      // The redirect to the dashboard comes through as a thrown signal.
      unstable_rethrow(error);
      toast("Couldn’t withdraw your candidacy. Try again.", "error");
    }
  }} />;
}
