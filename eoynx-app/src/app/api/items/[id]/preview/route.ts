import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: item, error } = await supabase
    .from("items")
    .select("id, title, image_url, brand, category, visibility")
    .eq("id", id)
    .maybeSingle();

  if (error || !item || item.visibility !== "public") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    id: item.id,
    title: item.title,
    image_url: item.image_url,
    brand: item.brand,
    category: item.category,
  });
}
