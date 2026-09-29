import type { NextConfig } from "next";

// Portal uploads are member photos up to 1 MB (see src/lib/data/uploads.ts); leave room for form overhead.
const uploadLimit = "2mb";

// Member photos are served from the Supabase Storage `uploads` bucket.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
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
