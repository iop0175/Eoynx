import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { getProfileByHandle } from "@/lib/db";
import { getFollowingPaginated, type FollowUser } from "@/app/actions/social";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PageShell } from "@/components/page-shell";
import { FollowingListClient } from "./following-client";

type Props = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const { data: profile } = await getProfileByHandle(handle);

  const title = profile 
    ? `${profile.display_name ?? `@${profile.handle}`} - Following`
    : `@${handle} - Following`;

  return {
    title,
  };
}

export default async function FollowingPage({ params }: Props) {
  const { handle } = await params;
  const [{ data: profile, error }, t] = await Promise.all([
    getProfileByHandle(handle),
    getTranslations("following"),
  ]);

  if (error || !profile) notFound();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;

  const initialData = await getFollowingPaginated(profile.id);

  return (
    <PageShell 
      title={t("title")}
      subtitle={t("subtitle", { handle: profile.handle })}
    >
      <div className="mx-auto w-full max-w-xl">
        {/* Back link */}
        <Link
          href={`/u/${handle}`}
          className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToProfile")}
        </Link>

        {/* List */}
        <FollowingListClient
          userId={profile.id}
          initialUsers={initialData.users}
          initialHasMore={initialData.hasMore}
          initialCursor={initialData.nextCursor}
          isOwner={isOwner}
        />
      </div>
    </PageShell>
  );
}
