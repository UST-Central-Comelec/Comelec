import { redirect } from "next/navigation";
import { rsvpFormPath } from "@/lib/events/rsvp";

// Keep previously shared RSVP links working at the clean form URL.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(rsvpFormPath(id));
}
