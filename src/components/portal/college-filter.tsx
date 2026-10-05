"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dropdown, optionsFrom } from "./dropdown";

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
    <Dropdown size="pill" label="Show college" value={value} onChange={choose} options={[{ value: "", label: "All colleges" }, ...optionsFrom(colleges)]} />
  );
}
