import { redirect, notFound } from "next/navigation";
import { NOINDEX } from "@/lib/robots";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getItemWithOwner } from "@/lib/db-item";
import EditClientPage from "./edit-client";

export const metadata = {
  title: "Edit Item",
  robots: NOINDEX,
};

interface EditPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPage({ params }: EditPageProps) {
  const { id } = await params;
  
  // 로그인 확인
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/auth?next=/i/${id}/edit`);
  }

  // 아이템 조회
  const { data: item, error } = await getItemWithOwner(id);
  
  if (error || !item) {
    notFound();
  }

  // 소유자 확인
  if (item.owner_id !== user.id) {
    redirect(`/i/${id}`);
  }

  return <EditClientPage item={item} />;
}
