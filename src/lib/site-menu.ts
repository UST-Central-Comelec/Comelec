import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { isCodePublic } from "@/lib/codes/settings";
import { getNews } from "@/lib/data/queries";
import { listUnitPeriodsForSite } from "@/lib/periods/store";

// What the site's menu and footer read on every page: each unit's periods, the latest news and
// which charters are public. Pages that render per request (News, Archive, Apply, an event…)
// would otherwise make these reads on every visit, so they're kept for up to a minute, the same
// as the prerendered pages. Saving any of them in the portal clears this straight away
// (refreshSiteMenu). Only the raw rows are kept: whether a period is open is worked out on each
// request, so it still closes on the minute.

export const SITE_MENU_TAG = "site-menu";

const MAX_NEWS = 4;

/** The newsroom's featured story, then the latest posts: just what the menu's cards show. */
async function latestNews() {
  try {
    const news = await getNews();
    return [...news.filter((post) => post.featured), ...news.filter((post) => !post.featured)]
      .slice(0, MAX_NEWS)
      .map(({ id, title, excerpt, category, date }) => ({ id, title, excerpt, category, date }));
  } catch (error) {
    // A newsroom hiccup shouldn't take the whole site down; the menu just shows fewer cards.
    console.error(error);
    return [];
  }
}

export type SiteMenuNews = Awaited<ReturnType<typeof latestNews>>;

export const getSiteMenuData = unstable_cache(
  async () => {
    const [periods, news, constitution, electionsCode, magnaCarta] = await Promise.all([listUnitPeriodsForSite(), latestNews(), isCodePublic("constitution"), isCodePublic("elections-code"), isCodePublic("magna-carta")]);
    return { periods, news, documents: { constitution, "elections-code": electionsCode, "magna-carta": magnaCarta } };
  },
  [SITE_MENU_TAG],
  { tags: [SITE_MENU_TAG], revalidate: 60 },
);

/** After a portal save that changes what the menu shows: the next visit reads it fresh. */
export function refreshSiteMenu() {
  revalidateTag(SITE_MENU_TAG, { expire: 0 });
}
