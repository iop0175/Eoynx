"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// =====================================================
// Create Collection
// =====================================================

export async function createCollection(data: {
  name: string;
  description?: string;
  isPublic?: boolean;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { data: collection, error } = await supabase
    .from("collections")
    .insert({
      owner_id: user.id,
      name: data.name,
      description: data.description || null,
      is_public: data.isPublic ?? true,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/u/[handle]/collections`);
  return { success: true, id: collection.id };
}

// =====================================================
// Update Collection
// =====================================================

export async function updateCollection(
  collectionId: string,
  data: {
    name?: string;
    description?: string;
    isPublic?: boolean;
  }
) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description || null;
  if (data.isPublic !== undefined) updates.is_public = data.isPublic;

  const { error } = await supabase
    .from("collections")
    .update(updates)
    .eq("id", collectionId)
    .eq("owner_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/c/${collectionId}`);
  return { success: true };
}

// =====================================================
// Delete Collection
// =====================================================

export async function deleteCollection(collectionId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  const { error } = await supabase
    .from("collections")
    .delete()
    .eq("id", collectionId)
    .eq("owner_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/u/[handle]/collections`);
  return { success: true };
}

// =====================================================
// Add Item to Collection
// =====================================================

export async function addItemToCollection(collectionId: string, itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  // Verify user owns the collection
  const { data: collection } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collectionId)
    .eq("owner_id", user.id)
    .single();

  if (!collection) {
    return { error: "컬렉션을 찾을 수 없습니다" };
  }

  // Get the next position
  const { data: lastItem } = await supabase
    .from("collection_items")
    .select("position")
    .eq("collection_id", collectionId)
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const nextPosition = (lastItem?.position ?? 0) + 1;

  const { error } = await supabase
    .from("collection_items")
    .insert({
      collection_id: collectionId,
      item_id: itemId,
      position: nextPosition,
    });

  if (error) {
    if (error.code === "23505") {
      return { error: "이미 컬렉션에 추가되어 있습니다" };
    }
    return { error: error.message };
  }

  revalidatePath(`/c/${collectionId}`);
  return { success: true };
}

// =====================================================
// Remove Item from Collection
// =====================================================

export async function removeItemFromCollection(collectionId: string, itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "로그인이 필요합니다" };
  }

  // Verify user owns the collection
  const { data: collection } = await supabase
    .from("collections")
    .select("id")
    .eq("id", collectionId)
    .eq("owner_id", user.id)
    .single();

  if (!collection) {
    return { error: "컬렉션을 찾을 수 없습니다" };
  }

  const { error } = await supabase
    .from("collection_items")
    .delete()
    .eq("collection_id", collectionId)
    .eq("item_id", itemId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/c/${collectionId}`);
  return { success: true };
}

// =====================================================
// Get User's Collections (for adding item)
// =====================================================

export async function getUserCollections() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { collections: [] };
  }

  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, is_public")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return { collections: collections ?? [] };
}

// =====================================================
// Check if item is in any of user's collections
// =====================================================

export async function getItemCollectionStatus(itemId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { inCollections: [] };
  }

  // Get user's collections that contain this item
  const { data } = await supabase
    .from("collection_items")
    .select("collection_id, collections(id, name)")
    .eq("item_id", itemId)
    .returns<{ collection_id: string; collections: { id: string; name: string } }[]>();

  const inCollections = (data ?? [])
    .filter((d) => d.collections)
    .map((d) => ({
      id: d.collections.id,
      name: d.collections.name,
    }));

  return { inCollections };
}
