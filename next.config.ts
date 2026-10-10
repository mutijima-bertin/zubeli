import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Product images are served from Vercel Blob
  // (https://<store>.public.blob.vercel-storage.com/<path>) once uploaded via
  // the admin upload route. Without this allowlist next/image rejects those
  // remote URLs at runtime and every uploaded product photo fails to render.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
