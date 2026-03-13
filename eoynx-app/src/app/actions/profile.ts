"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type UpdateProfileInput = {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  handle?: string;
  dmOpen?: boolean;
};

// Validate handle format
function isValidHandle(handle: string): boolean {
  // Must be 3-30 characters, lowercase letters, numbers, underscores only
  const regex = /^[a-z0-9_]{3,30}$/;
  return regex.test(handle);
}

// Check if handle is available
export async function checkHandleAvailability(handle: string, excludeUserId?: string) {
  const supabase = await createSupabaseServerClient();

  // Validate format
  if (!isValidHandle(handle)) {
    return { 
      available: false, 
      error: "핸들은 3-30자의 영문 소문자, 숫자, 밑줄(_)만 사용 가능합니다" 
    };
  }

  // Check if handle is taken
  let query = supabase
    .from("profiles")
    .select("id")
    .eq("handle", handle);
  
  if (excludeUserId) {
    query = query.neq("id", excludeUserId);
  }

  const { data } = await query.maybeSingle();

  if (data) {
    return { available: false, error: "이미 사용 중인 핸들입니다" };
  }

  return { available: true };
}

export async function updateProfile(input: UpdateProfileInput) {
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be logged in to update your profile" };
  }

  // Get current profile for comparison
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", user.id)
    .single();

  const oldHandle = currentProfile?.handle;

  // Build updates object
  const updates: Record<string, unknown> = {};
  if (input.displayName !== undefined) updates.display_name = input.displayName || null;
  if (input.bio !== undefined) updates.bio = input.bio || null;
  if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl || null;
  if (input.dmOpen !== undefined) updates.dm_open = input.dmOpen;
  
  // Handle update with validation
  if (input.handle !== undefined && input.handle !== oldHandle) {
    const handleToSave = input.handle.toLowerCase().trim();
    
    // Validate format
    if (!isValidHandle(handleToSave)) {
      return { error: "핸들은 3-30자의 영문 소문자, 숫자, 밑줄(_)만 사용 가능합니다" };
    }
    
    // Check availability
    const availability = await checkHandleAvailability(handleToSave, user.id);
    if (!availability.available) {
      return { error: availability.error };
    }
    
    updates.handle = handleToSave;
  }

  // Update profile
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    console.error("Error updating profile:", error);
    return { error: error.message };
  }

  // Get the user's new handle for path revalidation
  const { data: profile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", user.id)
    .single();

  // Revalidate both old and new paths if handle changed
  if (oldHandle && oldHandle !== profile?.handle) {
    revalidatePath(`/u/${oldHandle}`);
  }
  if (profile?.handle) {
    revalidatePath(`/u/${profile.handle}`);
  }
  revalidatePath("/settings/profile");

  return { success: true, newHandle: profile?.handle };
}

export async function uploadAvatar(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be logged in to upload an avatar" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { error: "No file provided" };
  }

  // Validate file size (2MB limit for avatars)
  if (file.size > 2 * 1024 * 1024) {
    return { error: "Avatar must be less than 2MB" };
  }

  // Validate file type
  if (!file.type.startsWith("image/")) {
    return { error: "File must be an image" };
  }

  // Generate unique filename
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${user.id}/${Date.now()}.${ext}`;

  // Upload to storage
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filename, file, { upsert: true });

  if (uploadError) {
    console.error("Error uploading avatar:", uploadError);
    return { error: uploadError.message };
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(filename);

  // Update profile with new avatar URL
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);

  if (updateError) {
    console.error("Error updating profile avatar:", updateError);
    return { error: updateError.message };
  }

  revalidatePath("/settings/profile");

  return { url: publicUrl };
}

export async function removeAvatar() {
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be logged in to remove your avatar" };
  }

  // Update profile to remove avatar URL
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", user.id);

  if (error) {
    console.error("Error removing avatar:", error);
    return { error: error.message };
  }

  revalidatePath("/settings/profile");

  return { success: true };
}

export async function updateDMOpenSetting(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return;
  }

  const value = String(formData.get("dm_open"));
  const dmOpen = value === "true";

  await supabase
    .from("profiles")
    .update({ dm_open: dmOpen })
    .eq("id", user.id);

  revalidatePath("/settings");
}

// Profile item sort types
export type ProfileItemSortBy = "latest" | "oldest" | "likes";

export type ProfileItemResult = {
  id: string;
  title: string;
  brand: string | null;
  category: string | null;
  image_url: string | null;
  image_urls: string[];
  like_count: number;
  created_at: string;
};

export async function getProfileItems(
  ownerId: string,
  sortBy: ProfileItemSortBy = "latest"
): Promise<{ items: ProfileItemResult[]; error?: string }> {
  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawItems, error } = await supabase
    .from("items")
    .select("id,title,brand,category,image_url,image_urls,created_at,likes:likes(count)")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: sortBy === "oldest" });

  if (error) {
    console.error("Error fetching profile items:", error);
    return { items: [], error: error.message };
  }

  if (!rawItems) {
    return { items: [] };
  }

  // Transform data and add like count
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let items: ProfileItemResult[] = (rawItems as any[]).map((it) => ({
    id: it.id as string,
    title: it.title as string,
    brand: it.brand as string | null,
    category: it.category as string | null,
    image_url: it.image_url as string | null,
    image_urls: (it.image_urls ?? []) as string[],
    created_at: it.created_at as string,
    like_count: Array.isArray(it.likes) ? (it.likes[0]?.count ?? 0) : 0,
  }));

  // Sort by likes if requested (need to do client-side for now)
  if (sortBy === "likes") {
    items = items.sort((a, b) => b.like_count - a.like_count);
  }

  return { items };
}

/**
 * E2E 암호화용 공개키 저장
 */
export async function saveEncryptionPublicKey(
  publicKeyJwk: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ encryption_public_key: publicKeyJwk })
    .eq("id", user.id);

  if (error) {
    console.error("Error saving encryption public key:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * 특정 사용자의 E2E 암호화용 공개키 조회
 */
export async function getEncryptionPublicKey(
  userId: string
): Promise<{ publicKey: string | null; error?: string }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("encryption_public_key")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Error fetching encryption public key:", error);
    return { publicKey: null, error: error.message };
  }

  return { publicKey: data?.encryption_public_key ?? null };
}

// =====================================================
// Get Following List (for DM sharing)
// =====================================================

export async function getFollowingList() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { following: [] };
  }

  // Get users that current user is following
  const { data: followData, error } = await supabase
    .from("followers")
    .select("following_id")
    .eq("follower_id", user.id);

  if (error || !followData || followData.length === 0) {
    return { following: [] };
  }

  const followingIds = followData.map(f => f.following_id);

  // Get profile info for following users
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, handle, display_name, avatar_url")
    .in("id", followingIds)
    .order("display_name", { ascending: true, nullsFirst: false });

  return { 
    following: profiles ?? [] 
  };
}
