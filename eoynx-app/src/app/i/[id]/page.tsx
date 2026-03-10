import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { VerifiedValueBlock } from "@/components/ui/verified-value-block";
import { VisibilityBadge } from "@/components/ui/visibility-badge";
import { ImageSlider } from "@/components/ui/image-slider";
import { SaveToCollection } from "@/components/ui/save-to-collection";
import { Comments } from "@/components/ui/comments";
import { PageShell } from "@/components/page-shell";
import { getItemWithOwner, getVerifiedValue, listVerifiedSources } from "@/lib/db-item";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getItemCollectionStatus } from "@/app/actions/collections";
import { getComments } from "@/app/actions/comments";

interface ItemPageProps {
  params: Promise<{ id: string }>;
}


// Dynamic metadata (SEO)
export async function generateMetadata({ params }: ItemPageProps): Promise<Metadata> {
  const { id } = await params;
  const { data: item } = await getItemWithOwner(id);

  // If not found (or private via RLS), we still avoid indexing.
  const isUnlisted = item?.visibility === "unlisted";
  const isPrivateOrMissing = !item || item.visibility === "private";

  const title = item?.title ? `${item.title} · EOYNX` : `Item ${id} · EOYNX`;
  const description = item?.description ?? "Public item page on EOYNX.";

  return {
    title,
    description,
    robots: {
      index: !(isUnlisted || isPrivateOrMissing),
      follow: !(isUnlisted || isPrivateOrMissing),
    },
    openGraph: {
      title,
      description,
      type: "article",
      url: `/i/${id}`,
      images: item?.image_url ? [{ url: item.image_url }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: item?.image_url ? [item.image_url] : undefined,
    },
  };
}

export default async function ItemPage({ params }: ItemPageProps) {
  const { id } = await params;

  const { data: item, error } = await getItemWithOwner(id);
  if (error || !item) notFound();
  if (item.visibility === "private") notFound();

  // 현재 사용자 확인
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isOwner = user?.id === item.owner_id;
  const isLoggedIn = !!user;

  const ownerHandle = item.profiles?.handle ?? "unknown";
  const ownerDisplayName = item.profiles?.display_name ?? ownerHandle;

  // Fetch data in parallel
  const [verifiedValueResult, collectionStatus, commentsResult] = await Promise.all([
    getVerifiedValue(item.id),
    getItemCollectionStatus(item.id),
    getComments(item.id),
  ]);

  const verifiedValue = verifiedValueResult.data;
  const { data: sources } = verifiedValue ? await listVerifiedSources(verifiedValue.id) : { data: [] };

  // Use image_urls if available, otherwise fall back to image_url
  const images = item.image_urls?.length > 0 ? item.image_urls : (item.image_url ? [item.image_url] : []);

  // Format price
  const formatPrice = (minor: number, currency: string) => {
    const amount = minor / 100;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  return (
    <PageShell
      title={item.title}
      subtitle={item.description ?? undefined}
      actions={
        <div className="flex items-center gap-2">
          <SaveToCollection 
            itemId={item.id} 
            initialInCollections={collectionStatus.inCollections}
            isLoggedIn={isLoggedIn}
          />
          {isOwner && (
            <Link
              href={`/i/${item.id}/edit`}
              className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            >
              Edit
            </Link>
          )}
          <VisibilityBadge visibility={item.visibility} />
        </div>
      }
    >
      <div className="grid gap-4">
        {/* Image Slider */}
        <ImageSlider images={images} alt={item.title} />

        {/* Item Details */}
        {(item.category || item.brand || item.price_minor) && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
            <div className="grid gap-3 text-sm">
              {item.category && (
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Category</div>
                  <div className="mt-0.5 font-medium">{item.category}</div>
                </div>
              )}
              {item.brand && (
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Brand</div>
                  <div className="mt-0.5 font-medium">{item.brand}</div>
                </div>
              )}
              {item.price_minor && item.price_currency && (
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">Price</div>
                  <div className="mt-0.5 font-medium">{formatPrice(item.price_minor, item.price_currency)}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hashtags */}
        {item.hashtags && item.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {item.hashtags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {verifiedValue ? (
          <VerifiedValueBlock
            currency={verifiedValue.currency}
            minorUnit={verifiedValue.minor_unit}
            medianMinor={verifiedValue.verified_median_minor}
            minMinor={verifiedValue.verified_min_minor}
            maxMinor={verifiedValue.verified_max_minor}
            sources={(sources ?? []).map((s) => ({ label: s.label, url: s.url }))}
          />
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-black dark:text-neutral-300">
            No verified value yet.
          </div>
        )}

        <div className="rounded-xl border border-neutral-200 bg-white p-4 text-sm dark:border-neutral-800 dark:bg-black">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">Owner</div>
          <div className="mt-2">
            <Link href={`/u/${ownerHandle}`} className="font-medium hover:underline">
              {ownerDisplayName} (@{ownerHandle})
            </Link>
          </div>
        </div>

        {/* Comments Section */}
        <Comments
          itemId={item.id}
          initialComments={commentsResult.comments}
          initialTotal={commentsResult.total}
          isLoggedIn={isLoggedIn}
          currentUserId={user?.id}
          isItemOwner={isOwner}
        />

        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          <Link href="/" className="hover:underline">
            Home
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
