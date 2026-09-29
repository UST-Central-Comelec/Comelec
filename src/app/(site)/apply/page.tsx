import type { Metadata } from "next";
import { connection } from "next/server";
import { ApplicationForm } from "@/components/application-form";
import { positions, type SlotCounts } from "@/lib/applications/options";
import { getSlots } from "@/lib/applications/slots";

export const metadata: Metadata = { title: "Apply now" };

async function loadSlots(): Promise<SlotCounts> {
  try {
    return await getSlots();
  } catch (error) {
    // Most likely the recruitment tables haven't been created yet. Show every position as full
    // rather than breaking the page.
    console.error(error);
    return Object.fromEntries(positions.map((position) => [position.id, 0]));
  }
}

export default async function ApplyPage() {
  // Slot counts change from the portal, so read them on every request.
  await connection();
  const slots = await loadSlots();

  return (
    <main className="apply-page">
      <ApplicationForm slots={slots} />
    </main>
  );
}
