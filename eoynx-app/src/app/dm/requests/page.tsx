import { redirect } from "next/navigation";
import { NOINDEX } from "@/lib/robots";
import { PageShell } from "@/components/page-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDMRequests } from "@/app/actions/dm";
import { DMRequestsClient } from "./dm-requests-client";

export const metadata = {
  title: "DM Requests",
  robots: NOINDEX,
};

export default async function DMRequestsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { requests } = await getDMRequests();

  return (
    <PageShell title="메시지 요청" subtitle="메시지 요청을 검토하세요.">
      <DMRequestsClient initialRequests={requests} />
    </PageShell>
  );
}
