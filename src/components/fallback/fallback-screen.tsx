import type { ReactNode } from "react";
import "./fallback.css";

type Action = { label: string; primary?: boolean } & ({ href: string } | { onClick: () => void; disabled?: boolean });

/**
 * The full-height screen shown in place of a page that can't be shown: something broke, the site
 * is down for maintenance, or the visitor is being rate-limited. Styled on its own (fallback.css), so it works under any layout or none.
 * Links are plain `<a>`s on purpose: after a crash a full page load is the surest way out.
 */
export function FallbackScreen({ code, eyebrow, working, title, children, actions, reference, belowHeader }: {
  /** The status code, drawn huge and faint behind the copy. */
  code: string;
  eyebrow: string;
  /** Work is under way (maintenance): the eyebrow's marker pulses amber. */
  working?: boolean;
  title: ReactNode;
  children: ReactNode;
  actions?: Action[];
  /** An error's digest, to quote when reporting it. */
  reference?: string;
  /** The site's header is above this screen, so it's shorter by the header's height. */
  belowHeader?: boolean;
}) {
  return (
    <main className={`fb${belowHeader ? " is-below-header" : ""}`}>
      <div className="fb-inner">
        <span className="fb-code" aria-hidden="true">{code}</span>
        <p className={`fb-eyebrow${working ? " is-working" : ""}`}>{eyebrow}</p>
        <h1 className="fb-title">{title}</h1>
        <p className="fb-text">{children}</p>
        {actions && actions.length > 0 && (
          <div className="fb-actions">
            {actions.map((action, index) => {
              const className = `fb-button${action.primary ? " is-primary" : ""}`;
              return "href" in action
                ? <a key={action.label} className={className} href={action.href}>{action.label}</a>
                // Keyed by place, not label: a countdown changes the label every second.
                : <button key={index} className={className} type="button" onClick={action.onClick} disabled={action.disabled}>{action.label}</button>;
            })}
          </div>
        )}
        {reference && <p className="fb-ref">Reference <b>{reference}</b></p>}
      </div>
    </main>
  );
}
