import { isHttpsDocumentLink } from "./options";

export const documentServiceLabels = { facebook: "Facebook", instagram: "Instagram", x: "Twitter / X", threads: "Threads", github: "GitHub", vercel: "Vercel" } as const;
export type DocumentService = keyof typeof documentServiceLabels;

const serviceDomains: Record<DocumentService, readonly string[]> = {
  facebook: ["facebook.com", "fb.com", "fb.watch"],
  instagram: ["instagram.com", "instagr.am"],
  x: ["twitter.com", "x.com", "t.co"],
  threads: ["threads.net", "threads.com"],
  github: ["github.com", "github.io"],
  vercel: ["vercel.com", "vercel.app"],
};

export function documentService(url: string): DocumentService | null {
  if (!isHttpsDocumentLink(url)) return null;
  const hostname = new URL(url).hostname;
  return (Object.keys(serviceDomains) as DocumentService[]).find(service => serviceDomains[service].some(domain => hostname === domain || hostname.endsWith(`.${domain}`))) ?? null;
}
