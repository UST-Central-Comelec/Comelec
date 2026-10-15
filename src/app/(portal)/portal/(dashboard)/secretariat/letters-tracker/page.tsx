import type { Metadata } from "next";
import { LettersTracker } from "@/components/portal/letters-tracker";
import { SlidingFilters } from "@/components/portal/sliding-filters";
import { isLocal, requireAccess } from "@/lib/auth/session";
import { canManageEvent } from "@/lib/events/access";
import { defaultSecretariatSettings } from "@/lib/letters/settings";
import { getSecretariatSettings } from "@/lib/letters/settings-store";
import { listLetters, listEventPapers } from "@/lib/letters/store";
import { getEventPaperNumberPreview, saveEventPaper, deleteEventPaper, setEventPaperLabel } from "@/lib/portal/event-paper-actions";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Letters Tracker" };

export default async function PortalSecretariatPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireAccess("secretariat/letters-tracker");
  const eventPapers = (await searchParams).view === "event-papers";
  const scope = { local: isLocal(user), college: user.college };
  const [records, settings] = await Promise.all([settle(eventPapers ? listEventPapers(scope) : listLetters(scope)), settle(getSecretariatSettings())]);
  const rows = (records.value ?? []).map(row => row.event ? { ...row, event: { ...row.event, editable: user.tabs.includes("events") && canManageEvent(user, row.event) } } : row);
  const selector = <SlidingFilters label="Letters Tracker view" active={eventPapers ? "event-papers" : "general"} items={[
    { key: "general", href: "/portal/secretariat/letters-tracker", label: "General Letters" },
    { key: "event-papers", href: "/portal/secretariat/letters-tracker?view=event-papers", label: "Event Papers" },
  ]} />;
  return <LettersTracker key={eventPapers ? "event-papers" : "general"} rows={rows} settings={settings.value?.settings ?? defaultSecretariatSettings} readOnly={user.readOnly} loadError={records.error ?? settings.error} preparerName={user.name || user.email} selector={selector} eventPapers={eventPapers} eventActions={eventPapers ? { previewNumber: getEventPaperNumberPreview, saveRecord: saveEventPaper, deleteRecord: deleteEventPaper, labelRecord: setEventPaperLabel } : undefined} />;
}
