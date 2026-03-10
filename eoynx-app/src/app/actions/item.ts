"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CreateItemInput = {
  title: string;
  description?: string;
  visibility: "public" | "unlisted" | "private";
  imageUrl?: string;
  imageUrls?: string[];
  category?: string;
  brand?: string;
  hashtags?: string[];
  priceMinor?: number;
  priceCurrency?: string;
};

export async function createItem(input: CreateItemInput) {
  const supabase = await createSupabaseServerClient();

  // 현재 사용자 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { error: "You must be logged in to create an item" };
  }

  // 첫 번째 이미지를 image_url로 사용 (하위 호환성)
  const primaryImage = input.imageUrls?.[0] || input.imageUrl || null;

  // 아이템 생성
  const { data: item, error } = await supabase
    .from("items")
    .insert({
      owner_id: user.id,
      title: input.title,
      description: input.description || null,
      visibility: input.visibility,
      image_url: primaryImage,
      image_urls: input.imageUrls || [],
      category: input.category || null,
      brand: input.brand || null,
      hashtags: input.hashtags || [],
      price_minor: input.priceMinor || null,
      price_currency: input.priceCurrency || 'USD',
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating item:", error);
    return { error: error.message };
  }

  revalidatePath("/feed");
  revalidatePath(`/u/${user.id}`);
  
  redirect(`/i/${item.id}`);
}

export async function uploadItemImage(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  // 현재 사용자 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { error: "You must be logged in to upload images" };
  }

  const file = formData.get("file") as File;
  if (!file) {
    return { error: "No file provided" };
  }

  // 파일 검증
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return { error: "File size must be less than 5MB" };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "File type not allowed. Use JPEG, PNG, WebP, or GIF" };
  }

  // 파일명 생성 (user_id/timestamp_random.ext)
  const ext = file.name.split(".").pop();
  const fileName = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

  // Supabase Storage에 업로드
  const { data, error } = await supabase.storage
    .from("items")
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("Upload error:", error);
    return { error: error.message };
  }

  // 공개 URL 생성
  const { data: { publicUrl } } = supabase.storage
    .from("items")
    .getPublicUrl(data.path);

  return { url: publicUrl };
}

export type UpdateItemInput = {
  id: string;
  title?: string;
  description?: string;
  visibility?: "public" | "unlisted" | "private";
  imageUrls?: string[];
  category?: string;
  brand?: string;
  hashtags?: string[];
  priceMinor?: number;
  priceCurrency?: string;
};

export async function updateItem(input: UpdateItemInput) {
  const supabase = await createSupabaseServerClient();

  // 현재 사용자 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { error: "You must be logged in to update an item" };
  }

  // 아이템 소유자 확인
  const { data: existingItem, error: fetchError } = await supabase
    .from("items")
    .select("owner_id")
    .eq("id", input.id)
    .single();

  if (fetchError || !existingItem) {
    return { error: "Item not found" };
  }

  if (existingItem.owner_id !== user.id) {
    return { error: "You can only edit your own items" };
  }

  // 업데이트할 필드 구성
  const updates: Record<string, unknown> = {};
  
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description || null;
  if (input.visibility !== undefined) updates.visibility = input.visibility;
  if (input.imageUrls !== undefined) {
    updates.image_urls = input.imageUrls;
    updates.image_url = input.imageUrls[0] || null; // 하위 호환성
  }
  if (input.category !== undefined) updates.category = input.category || null;
  if (input.brand !== undefined) updates.brand = input.brand || null;
  if (input.hashtags !== undefined) updates.hashtags = input.hashtags;
  if (input.priceMinor !== undefined) updates.price_minor = input.priceMinor || null;
  if (input.priceCurrency !== undefined) updates.price_currency = input.priceCurrency || 'USD';

  // 아이템 업데이트
  const { error } = await supabase
    .from("items")
    .update(updates)
    .eq("id", input.id);

  if (error) {
    console.error("Error updating item:", error);
    return { error: error.message };
  }

  revalidatePath(`/i/${input.id}`);
  revalidatePath("/feed");
  
  return { success: true };
}

export async function deleteItem(itemId: string) {
  const supabase = await createSupabaseServerClient();

  // 현재 사용자 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { error: "You must be logged in" };
  }

  // 아이템 삭제 (RLS가 owner 확인)
  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", itemId)
    .eq("owner_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/feed");
  redirect("/feed");
}
