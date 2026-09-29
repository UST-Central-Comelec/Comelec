"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Narrows the Local Comelec list to one college. Kept in the URL (?college=) so it survives a reload. */
export function CollegeFilter({ colleges, value }: { colleges: readonly string[]; value: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const choose = (college: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete("notice");
    if (college) params.set("college", college);
    else params.delete("college");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}#local-comelec` : `${pathname}#local-comelec`, { scroll: false });
  };

  return (
    <label className="directory-filter">
      <span className="portal-visually-hidden">Show college</span>
      <select value={value} onChange={(event) => choose(event.target.value)}>
        <option value="">All colleges</option>
        {colleges.map((college) => <option key={college} value={college}>{college}</option>)}
      </select>
    </label>
  );
}
