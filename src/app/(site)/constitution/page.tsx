import type { Metadata } from "next";
import { CodeDocument } from "@/components/elections-code/code-document";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { PageBanner } from "@/components/page-banner";
import { getPublishedCode } from "@/lib/codes/store";
import { countSections } from "@/lib/codes/text";
import { constitutionPdf } from "@/lib/elections-code/csc-constitution";
import "../banner-page.css";
import "../news/news.css";
import "../elections-code/elections-code.css";

export const metadata: Metadata = {
  title: "Constitution",
  description: "The Student Government Constitution of the University of Santo Tomas, which founds the Central Student Council and the Commission on Elections, section by section, with the PDF to download.",
};

const two = (value: number) => String(value).padStart(2, "0");
const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", day: "numeric", month: "long", year: "numeric" });

export default async function ConstitutionPage() {
  // The Constitution as the PDF has it, or as the latest revision approved in the portal has it.
  const { articles, version, publishedAt } = await getPublishedCode("constitution");

  return (
    <main className="bp nr ec">
      <RevealOnScroll />
      <PageBanner
        seed={2003}
        eyebrow="Voter info"
        title={<>The <em>Constitution.</em></>}
        lede="The Student Government Constitution of the University of Santo Tomas: students’ rights, the Central Student Council, and the Commission on Elections. Open a section to read it, search for a word, or download the PDF."
        readings={[
          // The Preamble leads the list but is not an article.
          { label: "Articles", value: two(articles.filter((article) => article.numeral).length) },
          { label: "Sections", value: String(countSections(articles)) },
          { label: "In effect", value: "SY 2003–04" },
        ]}
      />
      <CodeDocument articles={articles} pdf={constitutionPdf} name="Constitution">
        {version > 0 && publishedAt ? (
          <>Approved by the Constituent Assembly on 6 May 2002 and signed on 20 May 2002. The text here is as the commission last revised it, on {day.format(new Date(publishedAt))}. The PDF is the copy as it was signed, with the Foreword, and doesn’t carry that revision: <a href={constitutionPdf} download>download the PDF</a>.</>
        ) : (
          <>Approved by the Constituent Assembly on 6 May 2002 and signed on 20 May 2002. The text here is taken word for word from the PDF, which also carries the Foreword: <a href={constitutionPdf} download>download the PDF</a>.</>
        )}
      </CodeDocument>
    </main>
  );
}
