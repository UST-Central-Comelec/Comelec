import { permanentRedirect } from "next/navigation";

/** Notifications were renamed Announcements. */
export default function FilingNotificationsPage() {
  permanentRedirect("/filing/announcements");
}
