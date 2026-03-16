import { MetadataRoute } from "next";

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://eoynx.com").trim();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/u/", "/i/", "/c/", "/search"],
        disallow: [
          "/auth",
          "/auth/",
          "/add",
          "/dm",
          "/settings",
          "/feed",
          "/debug",
          "/api",
          "/notifications",
        ],
      },
    ],
    host: BASE_URL,
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
