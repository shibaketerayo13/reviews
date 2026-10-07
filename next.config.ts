import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // TMDB уже отдаёт картинки нужного размера (w185, w342, w500...),
    // поэтому не пережимаем их ещё раз: так не расходуется лимит
    // оптимизации картинок на бесплатном тарифе Vercel.
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org", pathname: "/t/p/**" },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
