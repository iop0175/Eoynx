import { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://eoynx.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/auth",
          "/add",
          "/dm",
          "/settings",
          "/feed",
          "/debug",
          "/api",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
