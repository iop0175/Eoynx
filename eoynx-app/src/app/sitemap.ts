import { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://eoynx.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createSupabaseServerClient();

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/search`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Get all public profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("handle, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  const profileRoutes: MetadataRoute.Sitemap = (profiles ?? []).map((profile) => ({
    url: `${BASE_URL}/u/${profile.handle}`,
    lastModified: new Date(profile.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Get all public items
  const { data: items } = await supabase
    .from("items")
    .select("id, created_at")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(5000);

  const itemRoutes: MetadataRoute.Sitemap = (items ?? []).map((item) => ({
    url: `${BASE_URL}/i/${item.id}`,
    lastModified: new Date(item.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Get all public collections
  const { data: collections } = await supabase
    .from("collections")
    .select("id, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(1000);

  const collectionRoutes: MetadataRoute.Sitemap = (collections ?? []).map((collection) => ({
    url: `${BASE_URL}/c/${collection.id}`,
    lastModified: new Date(collection.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  return [...staticRoutes, ...profileRoutes, ...itemRoutes, ...collectionRoutes];
}
