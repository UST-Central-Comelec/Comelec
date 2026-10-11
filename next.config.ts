import type { NextConfig } from "next";

// Portal uploads are member photos up to 1 MB (see src/lib/data/uploads.ts); leave room for form overhead.
const uploadLimit = "2mb";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Member photos are served from the public R2 bucket (older ones from the Supabase `uploads` bucket).
const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

// Security headers on every response (OWASP Secure Headers). The CSP here only covers what can't
// break the site: no framing (clickjacking), no plugins, no <base> hijacking, and forms may only
// post to this site or continue on to Google sign-in through Supabase.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Browsers only honour this over HTTPS, so it's harmless on localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Content-Security-Policy",
    value: ["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", `form-action 'self' https://accounts.google.com${supabaseUrl ? ` ${new URL(supabaseUrl).origin}` : ""}`].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  // `next dev` only: let phones on the same Wi-Fi or hotspot open the dev server by its private
  // address. Otherwise Next refuses their HMR connection and the page never hydrates (stuck loader).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`), "*.local"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Uploaded files served by src/app/files: even opened on their own, no scripts, styles or frames.
      { source: "/files/:path*", headers: [{ key: "Content-Security-Policy", value: "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox" }] },
      // Belt and braces with the portal's robots metadata: never index the portal.
      { source: "/portal/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  async redirects() {
    // Applications and Interviews moved under Recruitment; keep old links and bookmarks working.
    return [
      { source: "/portal/applications/:path*", destination: "/portal/recruitment/applications/:path*", permanent: true },
      { source: "/portal/interviews", destination: "/portal/recruitment/interviews", permanent: true },
      { source: "/portal/apps/secretariat", destination: "/portal/secretariat/letters-tracker", permanent: true },
      { source: "/portal/apps/calendar", destination: "/portal/secretariat/calendar", permanent: true },
      // Legals: retain bookmarks, links in old emails, and their query parameters.
      { source: "/portal/apps/approvals/:path*", destination: "/portal/documents/approval/:path*", permanent: true },
      { source: "/portal/codes/:path*", destination: "/portal/charters/:path*", permanent: true },
      { source: "/portal/documents", destination: "/portal/documents/archive", permanent: true },
      { source: "/portal/documents/new", destination: "/portal/documents/archive/new", permanent: true },
      { source: "/portal/petitions/submissions", destination: "/portal/petitions/case-docket", permanent: true },
      // Accounts → Settings became Access Control.
      { source: "/portal/accounts/settings", destination: "/portal/accounts/access-control", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      ...(r2PublicUrl ? [new URL(`${r2PublicUrl}/**`)] : []),
      ...(supabaseUrl ? [new URL(`${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/uploads/**`)] : []),
    ],
  },
  experimental: {
    serverActions: { bodySizeLimit: uploadLimit },
    // PolPaR's multipart route accepts a 30 MB document packet plus form overhead.
    // The route independently bounds the incoming stream; Server Actions retain the smaller limit.
    proxyClientMaxBodySize: "34mb",
  },
};

export default nextConfig;
