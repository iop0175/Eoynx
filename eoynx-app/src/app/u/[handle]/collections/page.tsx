import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CollectionsClient, type CollectionItem } from "./collections-client";

export const metadata = {
  title: "Collections",
};

type Props = { params: Promise<{ handle: string }> };

type ProfileRow = { id: string; handle: string; display_name: string | null };

type CollectionRow = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
};

export default async function UserCollectionsPage({ params }: Props) {
  const { handle } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,handle,display_name")
    .eq("handle", handle)
    .maybeSingle<ProfileRow>();

  if (!profile) notFound();

  // Check if current user is owner
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;

  // Get collections (owner sees all, others see only public)
  const query = supabase
    .from("collections")
    .select("id,name,description,is_public,created_at")
    .eq("owner_id", profile.id)
    .order("created_at", { ascending: false });

  // If not owner, only show public collections
  if (!isOwner) {
    query.eq("is_public", true);
  }

  const { data: collections } = await query.returns<CollectionRow[]>();

  const collectionItems: CollectionItem[] = (collections ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    is_public: c.is_public,
  }));

  return (
    <CollectionsClient
      collections={collectionItems}
      profileHandle={profile.handle}
      isOwner={isOwner}
    />
  );
}
