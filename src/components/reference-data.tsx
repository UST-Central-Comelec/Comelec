"use client";

import type { ReactNode } from "react";
import { applyReferenceData, type ReferenceData as Lists } from "@/lib/reference/data";

/**
 * Puts the Database's lists (colleges, programs, offices, positions, roles) in place in the browser
 * before anything below it renders, so every form and dropdown offers the saved ones. Each root
 * layout wraps its pages in it; the server does the same per request (ensureReferenceData).
 */
export function ReferenceData({ data, children }: { data: Lists; children: ReactNode }) {
  applyReferenceData(data);
  return children;
}
