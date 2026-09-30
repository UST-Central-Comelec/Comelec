import type { Metadata } from "next";
import "../globals.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { SiteFooter } from "@/components/site-footer";
import type { Featured } from "@/components/featured-carousel";
import { SiteHeader } from "@/components/site-header";
import { SiteLoader } from "@/components/site-loader";
import { SmoothScroll } from "@/components/smooth-scroll";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { getPeriodForApplyPage } from "@/lib/applications/apply-cache";
import { closingTime, formatClosing, isAccepting } from "@/lib/applications/period";
import { getNews } from "@/lib/data/queries";
import { formatDate, newsCategories } from "@/lib/data/types";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: {
    default: "UST Central Comelec",
    template: "%s | UST Central Comelec",
  },
  description:
    "The official election commission of the University of Santo Tomas.",
  icons: {
    icon: "/images/Logo-1.png",
    shortcut: "/images/Logo-1.png",
    apple: "/images/Logo-1.png",
  },
};

// Rebuilt at most once a minute, so the menu's Featured cards follow the application period and the
// newsroom (saving either in the portal also rebuilds every page straight away).
export const revalidate = 60;

const MAX_FEATURED = 4;

/** Open commissioner applications, while they're open. */
async function applicationsCard(): Promise<Featured[]> {
  const period = await getPeriodForApplyPage();
  if (!isAccepting(period)) return [];
  const closesAt = closingTime(period);
  return [{
    id: "commissioner-applications",
    href: "/apply",
    tag: "Now open",
    tone: "live",
    title: "Commissioner applications are open",
    description: "Join the commission and serve the Thomasian community.",
    footnote: closesAt === null ? "Apply now" : `Closes ${formatClosing(new Date(closesAt).toISOString())}`,
  }];
}

/** The newsroom's featured story, then the latest posts. */
async function newsCards(limit: number): Promise<Featured[]> {
  try {
    const news = await getNews();
    const posts = [...news.filter((post) => post.featured), ...news.filter((post) => !post.featured)].slice(0, limit);
    return posts.map((post) => ({
      id: `news-${post.id}`,
      href: `/news/${post.id}`,
      tag: newsCategories[post.category],
      tone: "news",
      title: post.title,
      description: post.excerpt,
      footnote: formatDate(post.date),
    }));
  } catch (error) {
    // A newsroom hiccup shouldn't take the whole site down; the menu just shows fewer cards.
    console.error(error);
    return [];
  }
}

/** The cards in the menu's Featured carousel, most important first. */
async function getFeatured(): Promise<Featured[]> {
  const applications = await applicationsCard();
  return [...applications, ...(await newsCards(MAX_FEATURED - applications.length))];
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const featured = await getFeatured();
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <SiteLoader />
        <SmoothScroll>
          <SiteHeader featured={featured} />
          {children}
          <SiteFooter />
        </SmoothScroll>
      </body>
    </html>
  );
}
