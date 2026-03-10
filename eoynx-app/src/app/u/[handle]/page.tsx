import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getProfileByHandle, getProfileStats, listItemsByOwner } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkIsFollowing } from "@/app/actions/social";
import { ProfileClient, type ProfileItem } from "./profile-client";

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
    openGraph: {
      title,
      description,
      type: "profile",
      url: `/u/${handle}`,
      images: profile?.avatar_url ? [{ url: profile.avatar_url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: profile?.avatar_url ? [profile.avatar_url] : undefined,
    },
  };
}

export default async function ProfilePage({ params }: Props) {
  const { handle } = await params;
  const { data: profile, error } = await getProfileByHandle(handle);

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

  const [stats, { data: items }] = await Promise.all([
    getProfileStats(profile.id),
    listItemsByOwner(profile.id),
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
        rank: 8, // TODO: calculate actual rank
      }}
      items={profileItems}
      isOwner={isOwner}
      isFollowing={isFollowing}
      isLoggedIn={isLoggedIn}
    />
  );
}
