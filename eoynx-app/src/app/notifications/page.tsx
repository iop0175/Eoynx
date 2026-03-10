import { redirect } from "next/navigation";
import { NOINDEX } from "@/lib/robots";
import { PageShell } from "@/components/page-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getNotifications } from "@/app/actions/notifications";
import { NotificationsClient } from "./notifications-client";

export const metadata = {
  title: "알림",
  robots: NOINDEX,
};

export default async function NotificationsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { notifications } = await getNotifications();

  return (
    <PageShell title="알림" subtitle="새로운 활동을 확인하세요">
      <NotificationsClient initialNotifications={notifications} />
    </PageShell>
  );
}
