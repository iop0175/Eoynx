import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ItemWithOwner = {
  id: string;
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
  owner_id: string;
  profiles: {
    handle: string;
    display_name: string | null;
  } | null;
};

export type VerifiedValueRow = {
  id: string;
  currency: string;
  minor_unit: number;
  verified_median_minor: number | null;
  verified_min_minor: number | null;
  verified_max_minor: number | null;
};

export type VerifiedSourceRow = {
  label: string;
  url: string | null;
};

export async function getItemWithOwner(id: string) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("items")
    .select("id,title,description,visibility,image_url,image_urls,category,brand,hashtags,price_minor,price_currency,owner_id,profiles(handle,display_name)")
    .eq("id", id)
    .maybeSingle<ItemWithOwner>();
}

export async function getVerifiedValue(itemId: string) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("item_values")
    .select(
      "id,currency,minor_unit,verified_median_minor,verified_min_minor,verified_max_minor"
    )
    .eq("item_id", itemId)
    .eq("track", "verified")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<VerifiedValueRow>();
}

export async function listVerifiedSources(itemValueId: string) {
  const supabase = await createSupabaseServerClient();
  return supabase
    .from("verified_sources")
    .select("label,url")
    .eq("item_value_id", itemValueId)
    .returns<VerifiedSourceRow[]>();
}
