import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DownloadIcon } from "@/components/lucide-animated/download";
import { CodeReader } from "@/components/portal/code-reader";
import { TitleWithInfo } from "@/components/portal/info-tip";
import { ViewOnlyTag } from "@/components/portal/view-only";
import { formatEventDate } from "@/lib/events/format";
import { versionName } from "@/lib/codes/options";
import { isCodePublic } from "@/lib/codes/settings";
import { getPublishedCode } from "@/lib/codes/store";
import { countSections } from "@/lib/codes/text";
import { constitutionPdf } from "@/lib/elections-code/csc-constitution";
import { usecPdf } from "@/lib/elections-code/usec-2011";
import { requireFilingAccount } from "@/lib/filing-portal/session";

// Charters: the Constitution and the Elections Code, to read in the filing portal. The text the
// website shows (the latest revision approved in the commission portal, or the text as signed),
// view only. A text the commission has hidden from the website isn't shown here either.

const charters = {
  constitution: {
    title: "Constitution",
    pdf: constitutionPdf,
    info: "The Student Government Constitution of the University of Santo Tomas: students’ rights, the Central Student Council, and the Commission on Elections. Open a section to read it; your browser’s find-in-page reaches into every section.",
    signed: "Approved by the Constituent Assembly on 6 May 2002, and signed on 20 May 2002.",
  },
  "elections-code": {
    title: "Elections Code",
    pdf: usecPdf,
    info: "The UST Students’ Election Code of 2011: political parties, certificates of candidacy, the campaign and its materials, petitions, protests and offenses. Open a section to read it; your browser’s find-in-page reaches into every section.",
    signed: "Signed and approved on 29 March 2011.",
  },
} as const;

type Charter = keyof typeof charters;
const isCharter = (value: string): value is Charter => Object.hasOwn(charters, value);

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  return { title: isCharter(code) ? charters[code].title : "Not found" };
}

export default async function FilingCharterPage({ params }: { params: Promise<{ code: string }> }) {
  await requireFilingAccount();
  const { code } = await params;
  if (!isCharter(code)) notFound();
  const charter = charters[code];
  const [visible, published] = await Promise.all([isCodePublic(code), getPublishedCode(code)]);
  const articles = published.articles.filter((article) => article.numeral).length;

  return (
    <main className="portal-page">
      <header className="portal-page-head">
        <div>
          <p className="portal-eyebrow">Charters</p>
          <TitleWithInfo info={charter.info}>{charter.title}</TitleWithInfo>
          <p className="portal-muted">{visible ? `${versionName(published.version)}${published.publishedAt ? `, revised ${formatEventDate(published.publishedAt.slice(0, 10))}` : ""} · ${articles} articles, ${countSections(published.articles)} sections · ${charter.signed}` : "Not available right now."}</p>
        </div>
        <div className="pp-head-actions">
          <ViewOnlyTag />
          {visible && <a className="portal-button is-ghost" href={charter.pdf} download><DownloadIcon size={15} aria-hidden="true" />Download the PDF</a>}
        </div>
      </header>
      {visible && published.articles.length
        ? <CodeReader articles={published.articles} />
        : <section className="portal-card"><p className="portal-empty">The Comelec has taken the {charter.title} down from the website for now, so it isn’t shown here either. Write to comelec@ust.edu.ph for a copy.</p></section>}
    </main>
  );
}
