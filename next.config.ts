import type { NextConfig } from "next";

// Portal uploads are member photos up to 1 MB (see src/lib/data/uploads.ts); leave room for form overhead.
const uploadLimit = "2mb";

// Member photos are served from the Supabase Storage `uploads` bucket.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

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
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Belt and braces with the portal's robots metadata: never index the portal.
      { source: "/portal/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  async redirects() {
    // Applications and Interviews moved under Recruitment; keep old links and bookmarks working.
    return [
      { source: "/portal/applications/:path*", destination: "/portal/recruitment/applications/:path*", permanent: true },
      { source: "/portal/interviews", destination: "/portal/recruitment/interviews", permanent: true },
    ];
  },
  images: {
    remotePatterns: supabaseUrl ? [new URL(`${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/uploads/**`)] : [],
  },
  experimental: {
    serverActions: { bodySizeLimit: uploadLimit },
    // Portal requests pass through src/proxy.ts, which buffers bodies up to this size.
    proxyClientMaxBodySize: uploadLimit,
  },
};

export default nextConfig;
