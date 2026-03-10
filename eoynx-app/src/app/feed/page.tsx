import { NOINDEX } from "@/lib/robots";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FeedCardItem } from "@/components/ui/feed-card";
import { checkBatchInteractions, getBatchLikeCounts } from "@/app/actions/social";
import { FeedClient } from "./feed-client";

export const metadata = {
  title: "Feed",
  robots: NOINDEX,
};

type ItemRow = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  category: string | null;
  visibility: "public" | "unlisted" | "private";
  profiles: { handle: string; display_name: string | null; avatar_url: string | null } | null;
};

export default async function FeedPage() {
  const supabase = await createSupabaseServerClient();

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  // Feed policy: public-only (exclude unlisted/private)
  const { data: items } = await supabase
    .from("items")
    .select("id,title,description,image_url,image_urls,category,visibility,profiles(handle,display_name,avatar_url)")
    .eq("visibility", "public")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<ItemRow[]>();

  const itemIds = (items ?? []).map((i) => i.id);

  // Fetch interactions in parallel
  const [interactions, likeCounts] = await Promise.all([
    checkBatchInteractions(itemIds),
    getBatchLikeCounts(itemIds),
  ]);

  const feed: FeedCardItem[] = (items ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    image_url: i.image_url,
    image_urls: i.image_urls ?? [],
    category: i.category,
    visibility: i.visibility,
    owner: {
      handle: i.profiles?.handle ?? "unknown",
      display_name: i.profiles?.display_name ?? null,
      avatar_url: i.profiles?.avatar_url ?? null,
    },
  }));

  return (
    <FeedClient 
      items={feed} 
      interactions={interactions}
      likeCounts={likeCounts}
      isLoggedIn={isLoggedIn}
    />
  );
}
