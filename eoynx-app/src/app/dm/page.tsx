import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NOINDEX } from "@/lib/robots";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getThreads, getDMRequests } from "@/app/actions/dm";
import { DMInboxClient } from "./dm-inbox-client";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dm");
  return {
    title: t("title"),
    robots: NOINDEX,
  };
}

export default async function DMInboxPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const [threadsResult, requestsResult] = await Promise.all([
    getThreads(),
    getDMRequests(),
  ]);

  return (
    <DMInboxClient 
      threads={threadsResult.threads}
      requestCount={requestsResult.requests.length}
      currentUserId={user.id}
    />
  );
}
