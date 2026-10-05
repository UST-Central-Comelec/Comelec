import type { Metadata } from "next";
import { CodeDocument } from "@/components/elections-code/code-document";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { PageBanner } from "@/components/page-banner";
import { getPublishedCode } from "@/lib/codes/store";
import { countSections } from "@/lib/codes/text";
import { usecPdf } from "@/lib/elections-code/usec-2011";
import "../banner-page.css";
import "../news/news.css";
import "./elections-code.css";

export const metadata: Metadata = {
  title: "USEC-2011",
  description: "The UST Students’ Election Code of 2011 (USEC), the rules behind every student election in the University of Santo Tomas, section by section, with the PDF to download.",
};

const two = (value: number) => String(value).padStart(2, "0");
const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", day: "numeric", month: "long", year: "numeric" });

export default async function ElectionsCodePage() {
  // The Code as it was signed, or as the latest revision approved in the portal has it.
  const { articles, version, publishedAt } = await getPublishedCode("elections-code");

  return (
    <main className="bp nr ec">
      <RevealOnScroll />
      <PageBanner
        seed={2011}
        eyebrow="Voter info"
        title={<>USEC-<em>2011.</em></>}
        lede="The UST Students’ Election Code of 2011: the rules every student election in the University is run by. Open a section to read it, search for a word, or download the PDF."
        readings={[
          { label: "Articles", value: two(articles.filter((article) => article.numeral).length) },
          { label: "Sections", value: String(countSections(articles)) },
          { label: "In effect", value: "June 2011" },
        ]}
      />
      <CodeDocument articles={articles} pdf={usecPdf} name="Code">
        {version > 0 && publishedAt ? (
          <>Signed and approved on 29 March 2011. The text here is as the commission last revised it, on {day.format(new Date(publishedAt))}. The PDF is the copy as it was signed, with the names of its signatories, and doesn’t carry that revision: <a href={usecPdf} download>download the PDF</a>.</>
        ) : (
          <>Signed and approved on 29 March 2011. The text here is taken word for word from the signed copy, which also carries the names of its signatories: <a href={usecPdf} download>download the PDF</a>.</>
        )}
      </CodeDocument>
    </main>
  );
}
