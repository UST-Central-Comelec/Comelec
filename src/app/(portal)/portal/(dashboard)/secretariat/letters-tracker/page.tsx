import type { Metadata } from "next";
import { LettersTracker } from "@/components/portal/letters-tracker";
import { isLocal, requireAccess } from "@/lib/auth/session";
import { defaultSecretariatSettings } from "@/lib/letters/settings";
import { getSecretariatSettings } from "@/lib/letters/settings-store";
import { listLetters } from "@/lib/letters/store";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Letters Tracker" };

export default async function PortalSecretariatPage() {
  const user = await requireAccess("secretariat/letters-tracker");
  const [records, settings] = await Promise.all([settle(listLetters({ local: isLocal(user), college: user.college })), settle(getSecretariatSettings())]);
  return <LettersTracker rows={records.value ?? []} settings={settings.value?.settings ?? defaultSecretariatSettings} readOnly={user.readOnly} loadError={records.error ?? settings.error} preparerName={user.name || user.email} />;
}
