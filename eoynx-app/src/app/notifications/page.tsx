import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { NOINDEX } from "@/lib/robots";
import { PageShell } from "@/components/page-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getNotifications } from "@/app/actions/notifications";
import { NotificationsClient } from "./notifications-client";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return {
    title: t("title"),
    robots: NOINDEX,
  };
}

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { notifications } = await getNotifications();

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")}>
      <NotificationsClient initialNotifications={notifications} currentUserId={user.id} />
    </PageShell>
  );
}
