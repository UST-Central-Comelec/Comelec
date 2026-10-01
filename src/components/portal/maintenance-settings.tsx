import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { InfoTip, TitleWithInfo } from "@/components/portal/info-tip";
import { Notice } from "@/components/portal/notice";
import { CookieNoticeForm, MaintenanceForm, ResetNoticeButton } from "@/components/portal/site-settings-forms";
import { formatClosing } from "@/lib/applications/period";
import { resetCookieNotice, updateCookieNotice, updateMaintenance } from "@/lib/portal/site-settings-actions";
import { MAINTENANCE_MESSAGE_MAX, type SiteSettings } from "@/lib/site-settings/store";

/** The screens shown when a page can't be, each opened for real in a new tab. */
const fallbackScreens = [
  { name: "Maintenance page", where: "Public website", detail: "What every public address shows while the website is under maintenance.", href: "/maintenance" },
  { name: "Error page", where: "Public website", detail: "A page that fails to load, between the site’s header and footer.", href: "/fallback-test" },
  { name: "Error page", where: "Portal", detail: "A portal page that fails to load, inside the sidebar and top bar.", href: "/portal/maintenance/test-error" },
  { name: "Full-screen error", where: "Everywhere", detail: "The last resort, when even the header or the portal’s shell can’t load.", href: "/portal/fallback-test" },
];

/** The portal's Maintenance tab. `settings` is null when they couldn't be loaded, with `loadError` saying why. */
export function MaintenanceSettings({ settings, loadError, notice }: { settings: SiteSettings | null; loadError: string | null; notice?: string | string[] }) {
  // The seeded row says "system"; only name a person once someone has changed it.
  const updated = settings?.updatedAt && settings.updatedBy && settings.updatedBy !== "system" ? `Last changed by ${settings.updatedBy} · ${formatClosing(settings.updatedAt)}` : null;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Executive</p>
          <TitleWithInfo info="Settings for the website as a whole: take it offline while it’s being worked on, control its cookie notice, and check the screens visitors see when something goes wrong.">Maintenance</TitleWithInfo>
        </div>
        <Link className="portal-button is-ghost" href="/" target="_blank">View website <ArrowUpRight size={15} /></Link>
      </header>
      <Notice notice={notice} />

      {settings ? (
        <>
          <section className={`period-overview ${settings.maintenance ? "is-closing" : "is-open"}`} aria-label="Website status">
            <div className="period-overview-main">
              <span className="period-overview-state"><i aria-hidden="true" />{settings.maintenance ? "Offline" : "Live"}</span>
              <h2>{settings.maintenance ? "Under maintenance" : "Website is live"}</h2>
              <p>
                {settings.maintenance
                  ? `Visitors see the maintenance page${settings.maintenanceSince ? `, since ${formatClosing(settings.maintenanceSince)}` : ""}. The portal still works.`
                  : "Visitors can reach every public page."}
              </p>
            </div>
            {updated && <p className="period-overview-meta">{updated}</p>}
          </section>

          <section className="portal-card portal-settings" aria-labelledby="maintenance-mode-title">
            <header className="portal-settings-head">
              <TitleWithInfo as="h2" className="portal-card-title" id="maintenance-mode-title" info="Takes the public website offline while it’s being worked on. Nothing is deleted: applications, filings and everything published come back exactly as they were.">Maintenance mode</TitleWithInfo>
            </header>
            <MaintenanceForm key={`${settings.maintenance}-${settings.maintenanceMessage}`} action={updateMaintenance} maintenance={settings.maintenance} message={settings.maintenanceMessage ?? ""} maxLength={MAINTENANCE_MESSAGE_MAX} />
          </section>

          <section className="portal-card portal-settings" aria-labelledby="cookie-notice-title">
            <header className="portal-settings-head">
              <TitleWithInfo as="h2" className="portal-card-title" id="cookie-notice-title" info="The small card that tells first-time visitors which cookies the website sets. The website only sets cookies it needs to work, so it’s a notice, not a consent prompt.">Cookie notice</TitleWithInfo>
              <Link className="portal-button is-ghost is-small" href="/cookies" target="_blank">Cookie policy <ArrowUpRight size={13} /></Link>
            </header>
            <div className="portal-setting">
              <div className="portal-setting-label">
                <span>Dismissals</span>
                <InfoTip>Visitors who dismissed the notice don’t see it again. Use this after the cookie policy changes, so everyone sees the notice once more.</InfoTip>
              </div>
              <div className="portal-setting-control">
                <form className="portal-setting-inline" action={resetCookieNotice}>
                  <ResetNoticeButton />
                  <span className="portal-chip">{settings.cookieNoticeResetAt ? <>Last reset <strong>{formatClosing(settings.cookieNoticeResetAt)}</strong></> : "Never reset"}</span>
                </form>
              </div>
            </div>
            <CookieNoticeForm key={String(settings.cookieNotice)} action={updateCookieNotice} shown={settings.cookieNotice} />
          </section>
        </>
      ) : (
        <p className="portal-form-error" role="alert">
          Couldn’t load the site settings. Run <code>supabase/migrations/0018_site_settings.sql</code> in the Supabase SQL Editor, then reload. ({loadError})
        </p>
      )}

      <section className="portal-card portal-settings" aria-labelledby="fallback-screens-title">
        <header className="portal-settings-head">
          <TitleWithInfo as="h2" className="portal-card-title" id="fallback-screens-title" info="Each link opens the real screen in a new tab, by loading a page that fails on purpose. Only executives signed in to the portal can open the error tests; they change nothing.">Fallback screens</TitleWithInfo>
        </header>
        <ul className="portal-fallbacks">
          {fallbackScreens.map((screen) => (
            <li key={screen.href}>
              <div>
                <span className="portal-list-kind">{screen.where}</span>
                <strong>{screen.name}</strong>
                <p className="portal-muted">{screen.detail}</p>
              </div>
              {/* A plain link: these live under other layouts, and one of them fails on purpose. */}
              <a className="portal-button is-ghost is-small" href={screen.href} target="_blank" rel="noopener">Open <ArrowUpRight size={13} aria-hidden="true" /></a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
