import Link from "next/link";
import { formatClosing } from "@/lib/applications/period";
import type { Notice } from "@/lib/filing-portal/types";
import "../filing-review.css";

/** The dot's colour for a notice, from its kind: green when something went through, amber when it went back. */
function toneOf(kind: string) {
  if (/approved|accredited|endorsed$|joined|qualified|restored/.test(kind) && !/not-/.test(kind)) return "is-ok";
  if (/changes|declined|not-endorsed|removed|withdrawn|disqualified/.test(kind)) return "is-warn";
  if (/sent|request/.test(kind)) return "is-gold";
  return "";
}

/** What an application's people have been told, newest first: the commission's record of what happened. */
export function Timeline({ notices, empty, linkable = false }: { notices: Array<Notice & { kind: string }>; empty: string; /** Notices link into the filing portal; the commission only follows them when it can. */ linkable?: boolean }) {
  if (!notices.length) return <p className="portal-empty">{empty}</p>;
  return (
    <ol className="fr-timeline">
      {notices.map((notice) => (
        <li key={notice.id} className={toneOf(notice.kind)}>
          <strong>{linkable && notice.href ? <Link href={notice.href}>{notice.title}</Link> : notice.title}</strong>
          {notice.body && <p>{notice.body}</p>}
          <small>{[notice.actor, formatClosing(notice.createdAt)].filter(Boolean).join(" · ")}</small>
        </li>
      ))}
    </ol>
  );
}
