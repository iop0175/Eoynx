import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getProfileByHandle, getProfileStats, listItemsByOwner } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkIsFollowing } from "@/app/actions/social";
import { calculateUserPercentile, calculateUserDemographicPercentiles } from "@/app/actions/percentile";
import { checkIsBlocked } from "@/app/actions/safety";
import { ProfileClient, type ProfileItem } from "./profile-client";

const BASE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://eoynx.com").trim();

type Props = {
  params: Promise<{ handle: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;

  const { data: profile } = await getProfileByHandle(handle);

  const title = profile?.display_name
    ? `${profile.display_name} (@${profile.handle}) · EOYNX`
    : `@${handle} · EOYNX`;

  const description = profile?.bio ?? `Public profile of @${handle} on EOYNX.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/u/${handle}`,
    },
    openGraph: {
      title,
      description,
      type: "profile",
      url: `${BASE_URL}/u/${handle}`,
      siteName: "EOYNX",
      images: [
        {
          url: `${BASE_URL}/u/${handle}/opengraph-image`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${BASE_URL}/u/${handle}/twitter-image`],
    },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { handle } = await params;
  const [{ data: profile, error }, t] = await Promise.all([
    getProfileByHandle(handle),
    getTranslations("profile"),
  ]);

  if (error || !profile) notFound();

  // Get current user to check if owner
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === profile.id;
  const isLoggedIn = !!user;

  // Check if current user is following this profile
  const { isFollowing } = !isOwner && user 
    ? await checkIsFollowing(profile.id)
    : { isFollowing: false };

  // Check if current user has blocked this profile
  const { isBlocked } = !isOwner && user
    ? await checkIsBlocked(profile.id)
    : { isBlocked: false };

  const [stats, { data: items }, percentileData, demographicPercentiles] = await Promise.all([
    getProfileStats(profile.id),
    listItemsByOwner(profile.id),
    calculateUserPercentile(profile.id),
    calculateUserDemographicPercentiles(profile.id),
  ]);

  // Map items to ProfileItem format
  const profileItems: ProfileItem[] = (items ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    brand: item.brand ?? null,
    category: item.category ?? null,
    image_url: item.image_url,
    image_urls: item.image_urls ?? [],
    likes: 0, // TODO: fetch actual likes count
  }));

  return (
    <ProfileClient
      profile={{
        id: profile.id,
        handle: profile.handle,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: profile.bio,
      }}
      stats={{
        items: stats.items,
        followers: stats.followers,
        following: stats.following,
        rank: percentileData.overallPercentile,
      }}
      demographicRanking={{
        ageGroupPercentile: demographicPercentiles.ageGroupPercentile,
        countryPercentile: demographicPercentiles.countryPercentile,
        ageGroupLabel: demographicPercentiles.ageGroupLabel,
        countryCode: demographicPercentiles.countryCode,
      }}
      categoryPercentiles={percentileData.categoryPercentiles}
      items={profileItems}
      isOwner={isOwner}
      isFollowing={isFollowing}
      isLoggedIn={isLoggedIn}
      isBlocked={isBlocked}
      translations={{
        sortBy: t("sortBy"),
        sortLatest: t("sortLatest"),
        sortOldest: t("sortOldest"),
        sortLikes: t("sortLikes"),
        noItemsInCategory: t("noItemsInCategory"),
      }}
    />
  );
}
