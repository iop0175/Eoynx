import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProfileRow = {
  id: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type ItemRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  visibility: "public" | "unlisted" | "private";
  image_url: string | null;
  image_urls: string[];
  category: string | null;
  brand: string | null;
  hashtags: string[];
  price_minor: number | null;
  price_currency: string | null;
  created_at: string;
};

export type CollectionRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
};

export async function getProfileByHandle(handle: string) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("profiles")
    .select("id,handle,display_name,bio,avatar_url,created_at")
    .eq("handle", handle)
    .maybeSingle<ProfileRow>();
}

export async function listCollectionsByOwner(ownerId: string) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("collections")
    .select("id,owner_id,name,description,is_public,created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .returns<CollectionRow[]>();
}

export async function getCollectionById(id: string) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("collections")
    .select("id,owner_id,name,description,is_public,created_at")
    .eq("id", id)
    .maybeSingle<CollectionRow>();
}

export async function listCollectionItems(id: string) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("collection_items")
    .select("position,item:items(id,title,visibility,image_url)")
    .eq("collection_id", id)
    .order("position", { ascending: true });
}

export async function getItemById(id: string) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("items")
    .select("id,owner_id,title,description,visibility,image_url,created_at")
    .eq("id", id)
    .maybeSingle<ItemRow>();
}

// =====================================================
// Profile Stats
// =====================================================

export async function getProfileStats(profileId: string) {
  const supabase = await createSupabaseServerClient();

  // Items count (public + unlisted only for anon, all for owner)
  const { count: itemCount } = await supabase
    .from("items")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", profileId);

  // Followers count
  const { count: followerCount } = await supabase
    .from("followers")
    .select("id", { count: "exact", head: true })
    .eq("following_id", profileId);

  // Following count
  const { count: followingCount } = await supabase
    .from("followers")
    .select("id", { count: "exact", head: true })
    .eq("follower_id", profileId);

  return {
    items: itemCount ?? 0,
    followers: followerCount ?? 0,
    following: followingCount ?? 0,
  };
}

export async function listItemsByOwner(ownerId: string) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("items")
    .select("id,owner_id,title,description,visibility,image_url,image_urls,category,brand,created_at")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .returns<ItemRow[]>();
}
