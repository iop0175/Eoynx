import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBlockedUsers } from "@/app/actions/safety";
import { BlockedUsersClient } from "./blocked-client";

export const metadata = {
  title: "차단된 사용자 · EOYNX",
  description: "차단된 사용자 목록을 관리합니다",
};

export default async function BlockedUsersPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { blockedUsers } = await getBlockedUsers();

  return <BlockedUsersClient initialBlockedUsers={blockedUsers ?? []} />;
}
