import { Suspense } from "react";
import { NOINDEX } from "@/lib/robots";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchFeedPage } from "@/app/actions/feed";
import { FeedClient } from "./feed-client";
import { FeedSkeleton } from "@/components/ui/feed-skeleton";

export const metadata = {
  title: "Feed",
  robots: NOINDEX,
};

// Feed includes per-user interaction state, so avoid route-level caching.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function FeedLoadingFallback() {
  return <FeedSkeleton count={3} />;
}

async function FeedContent() {
  const supabase = await createSupabaseServerClient();

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  // Fetch initial feed data
  const initialData = await fetchFeedPage();

  return (
    <FeedClient 
      initialData={initialData}
      isLoggedIn={isLoggedIn}
      currentUserId={user?.id}
    />
  );
}

export default function FeedPage() {
  return (
    <Suspense fallback={<FeedLoadingFallback />}>
      <FeedContent />
    </Suspense>
  );
}
