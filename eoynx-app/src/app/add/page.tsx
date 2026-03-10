import { redirect } from "next/navigation";
import { NOINDEX } from "@/lib/robots";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AddClientPage from "./add-client";

export const metadata = {
  title: "Add",
  robots: NOINDEX,
};

export default async function AddPage() {
  // 로그인 확인
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?next=/add");
  }

  return <AddClientPage />;
}
