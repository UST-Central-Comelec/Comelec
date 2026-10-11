import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CodeDocument } from "@/components/elections-code/code-document";
import { RevealOnScroll } from "@/components/home/reveal-on-scroll";
import { PageBanner } from "@/components/page-banner";
import { isCodePublic } from "@/lib/codes/settings";
import { getPublishedCode } from "@/lib/codes/store";
import { countSections } from "@/lib/codes/text";
import "../banner-page.css";
import "../news/news.css";
import "../elections-code/elections-code.css";

export const metadata: Metadata = { title: "Magna Carta" };

export default async function MagnaCartaPage() {
  if (!(await isCodePublic("magna-carta"))) notFound();
  const { articles } = await getPublishedCode("magna-carta");
  return (
    <main className="bp nr ec">
      <RevealOnScroll />
      <PageBanner seed={2012} eyebrow="Voter info" title={<>Magna <em>Carta.</em></>} lede="The Magna Carta, section by section."
        readings={[{ label: "Articles", value: String(articles.filter((article) => article.numeral).length) }, { label: "Sections", value: String(countSections(articles)) }]} />
      <CodeDocument articles={articles} name="Magna Carta">{articles.length === 0 ? "No contents yet." : null}</CodeDocument>
    </main>
  );
}
