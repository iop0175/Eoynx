import { redirect, notFound } from "next/navigation";
import { NOINDEX } from "@/lib/robots";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getThreadDetails, getMessages } from "@/app/actions/dm";
import { DMThreadClient } from "./dm-thread-client";

export const metadata = {
  title: "DM Thread",
  robots: NOINDEX,
};

type Props = { params: Promise<{ threadId: string }> };

export default async function DMThreadPage({ params }: Props) {
  const { threadId } = await params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const threadResult = await getThreadDetails(threadId);
  
  if (threadResult.error || !threadResult.thread) {
    notFound();
  }

  const messagesResult = await getMessages(threadId);

  return (
    <DMThreadClient
      threadId={threadId}
      otherUser={threadResult.otherUser!}
      initialMessages={messagesResult.messages}
      currentUserId={threadResult.currentUserId!}
    />
  );
}
