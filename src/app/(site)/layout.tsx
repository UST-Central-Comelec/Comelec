import type { Metadata } from "next";
import "../globals.css";
import "./header.css";
import "./cookie-notice.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import { CookieNotice } from "@/components/cookie-notice";
import { SiteFooter } from "@/components/site-footer";
import type { Featured } from "@/components/featured-carousel";
import type { NavStatus, PeriodReading } from "@/components/nav/nav-data";
import { SiteHeader } from "@/components/site-header";
import { SiteLoader } from "@/components/site-loader";
import { SmoothScroll } from "@/components/smooth-scroll";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { getPeriodForApplyPage } from "@/lib/applications/apply-cache";
import { closingTime, formatClosing, isAccepting, type ApplicationPeriod } from "@/lib/applications/period";
import { getNews } from "@/lib/data/queries";
import { formatDate, newsCategories } from "@/lib/data/types";
import { cookieNoticeVersion } from "@/lib/cookie-notice";
import { getFilingPeriodForSite } from "@/lib/filings/period-store";
import { getSiteSettingsForSite } from "@/lib/site-settings/store";
import { mono, serif } from "./fonts";

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

// Rebuilt at most once a minute, so the menu's Featured cards and its readings of what's open follow
// the application and filing periods and the newsroom (saving any of them in the portal also
// rebuilds every page straight away).
export const revalidate = 60;

const MAX_FEATURED = 4;

/** Open commissioner applications, while they're open. */
function applicationsCard(period: ApplicationPeriod): Featured[] {
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
async function newsCards(): Promise<Featured[]> {
  try {
    const news = await getNews();
    const posts = [...news.filter((post) => post.featured), ...news.filter((post) => !post.featured)].slice(0, MAX_FEATURED);
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

const dayMonth = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", month: "short", day: "numeric" });

/** A period as the menu reads it: whether it's open, and the day it closes ("Oct 29") when it has one. */
function reading(period: ApplicationPeriod): PeriodReading {
  const closesAt = closingTime(period);
  return { open: isAccepting(period), closes: closesAt === null ? null : dayMonth.format(closesAt) };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [applicationPeriod, candidacyPeriod, partyPeriod, news, settings] = await Promise.all([getPeriodForApplyPage(), getFilingPeriodForSite("candidacy"), getFilingPeriodForSite("party-registration"), newsCards(), getSiteSettingsForSite()]);
  // The cards in the menu's Featured carousel, most important first.
  const featured = [...applicationsCard(applicationPeriod), ...news].slice(0, MAX_FEATURED);
  const status: NavStatus = { applications: reading(applicationPeriod), candidacy: reading(candidacyPeriod), parties: reading(partyPeriod) };
  return (
    // The mono and the serif italic are the navbar's too (labels, accents), so they load on every page.
    <html lang="en" className={cn("font-sans", geist.variable, mono.variable, serif.variable)}>
      <body>
        <SiteLoader />
        <SmoothScroll>
          <SiteHeader featured={featured} status={status} />
          {/* Before the page in the tab order, so a keyboard reaches it without crossing the whole page. */}
          {settings.cookieNotice && <CookieNotice version={cookieNoticeVersion(settings.cookieNoticeResetAt)} />}
          {children}
          <SiteFooter />
        </SmoothScroll>
      </body>
    </html>
  );
}
