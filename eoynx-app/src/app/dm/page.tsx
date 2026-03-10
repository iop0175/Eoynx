import Link from "next/link";
import { redirect } from "next/navigation";
import { NOINDEX } from "@/lib/robots";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getThreads, getDMRequests } from "@/app/actions/dm";
import { DMInboxClient } from "./dm-inbox-client";

export const metadata = {
  title: "DM",
  robots: NOINDEX,
};

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
    />
  );
}
