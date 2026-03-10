"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type UpdateProfileInput = {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
};

export async function updateProfile(input: UpdateProfileInput) {
  const supabase = await createSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be logged in to update your profile" };
  }

  // Build updates object
  const updates: Record<string, unknown> = {};
  if (input.displayName !== undefined) updates.display_name = input.displayName || null;
  if (input.bio !== undefined) updates.bio = input.bio || null;
  if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl || null;

  // Update profile
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) {
    console.error("Error updating profile:", error);
    return { error: error.message };
  }

  // Get the user's handle for path revalidation
  const { data: profile } = await supabase
    .from("profiles")
    .select("handle")
    .eq("id", user.id)
    .single();

  if (profile?.handle) {
    revalidatePath(`/u/${profile.handle}`);
  }
  revalidatePath("/settings/profile");

  return { success: true };
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
