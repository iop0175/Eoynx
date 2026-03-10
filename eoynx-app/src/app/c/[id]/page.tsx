import Link from "next/link";
import { notFound } from "next/navigation";

import { ItemCard } from "@/components/ui/item-card";
import { PageShell } from "@/components/page-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Collection",
};

type Props = { params: Promise<{ id: string }> };

type CollectionRow = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
};

type CollectionItemRow = {
  position: number;
  item: {
    id: string;
    title: string;
    visibility: "public" | "unlisted" | "private";
    image_url: string | null;
  };
};

export default async function CollectionDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: col, error: colErr } = await supabase
    .from("collections")
    .select("id,owner_id,name,description,is_public,created_at")
    .eq("id", id)
    .single<CollectionRow>();

  if (colErr || !col) notFound();

  const { data: items } = await supabase
    .from("collection_items")
    .select("position,item:items(id,title,visibility,image_url)")
    .eq("collection_id", id)
    .order("position", { ascending: true })
    .returns<CollectionItemRow[]>();

  return (
    <PageShell title={col.name} subtitle={col.description ?? undefined}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          {col.is_public ? "Public" : "Private"}
        </div>
      </div>

      <div className="grid gap-2">
        {(items ?? []).map((row) => (
          <ItemCard
            key={row.item.id}
            id={row.item.id}
            title={row.item.title}
            visibility={row.item.visibility}
            imageUrl={row.item.image_url}
          />
        ))}

        {(items ?? []).length === 0 ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">No items in this collection.</p>
        ) : null}
      </div>

      <div className="mt-4">
        <Link
          href={`/u/demo/collections`}
          className="text-xs text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
        >
          Back to collections
        </Link>
      </div>
    </PageShell>
  );
}
