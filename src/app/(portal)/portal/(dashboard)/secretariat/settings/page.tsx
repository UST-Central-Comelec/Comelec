import type { Metadata } from "next";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { SecretariatSettingsForm } from "@/components/portal/secretariat-settings";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { requireAccess } from "@/lib/auth/session";
import { formatClosing } from "@/lib/applications/period";
import { defaultSecretariatSettings } from "@/lib/letters/settings";
import { getSecretariatSettings } from "@/lib/letters/settings-store";
import { settle } from "@/lib/portal/settle";

export const metadata: Metadata = { title: "Secretariat settings" };

export default async function PortalSecretariatSettingsPage() {
  const user = await requireAccess("secretariat/settings");
  const { value, error } = await settle(getSecretariatSettings());
  const updated = value?.updatedAt && value.updatedBy ? `Last changed by ${value.updatedBy} · ${formatClosing(value.updatedAt)}` : null;
  return (
    <main className="portal-page is-wide sec-settings-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Secretariat</p>
          <TitleWithInfo info="What the Letters Tracker and Minutes of the Meetings offer: their types and how each type’s control number is made, plus the labels, statuses, remark presets and destination office suggestions they share. These settings apply to every unit.">Settings</TitleWithInfo>
          {updated && <p className="portal-muted">{updated}</p>}
        </div>
        {user.readOnly && <ViewOnlyTag />}
      </header>
      {/* Editing is off when the saved settings couldn't be read, so defaults never overwrite them. */}
      {error && <p className="portal-form-error" role="alert">{error}</p>}
      <SecretariatSettingsForm initial={value?.settings ?? defaultSecretariatSettings} updatedAt={value?.updatedAt ?? null} readOnly={user.readOnly || Boolean(error)} />
    </main>
  );
}
