"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Lock, Globe, X } from "lucide-react";
import { createCollection, deleteCollection } from "@/app/actions/collections";

export type CollectionItem = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
};

type CollectionsClientProps = {
  collections: CollectionItem[];
  profileHandle: string;
  isOwner: boolean;
};

export function CollectionsClient({ collections: initialCollections, profileHandle, isOwner }: CollectionsClientProps) {
  const [collections, setCollections] = React.useState(initialCollections);
  const [showModal, setShowModal] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isPublic, setIsPublic] = React.useState(true);

  const handleCreate = async () => {
    if (!name.trim()) return;
    
    setCreating(true);
    const result = await createCollection({
      name: name.trim(),
      description: description.trim() || undefined,
      isPublic,
    });

    if (result.success && result.id) {
      setCollections([
        {
          id: result.id,
          name: name.trim(),
          description: description.trim() || null,
          is_public: isPublic,
        },
        ...collections,
      ]);
      setName("");
      setDescription("");
      setIsPublic(true);
      setShowModal(false);
    }
    setCreating(false);
  };

  const handleDelete = async (collectionId: string) => {
    if (!confirm("이 컬렉션을 삭제하시겠습니까?")) return;
    
    const result = await deleteCollection(collectionId);
    if (result.success) {
      setCollections(collections.filter((c) => c.id !== collectionId));
    }
  };

  const inputClass =
    "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder-neutral-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-neutral-800 dark:bg-neutral-950 dark:placeholder-neutral-500";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Collections</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">@{profileHandle}</p>
        </div>
        {isOwner && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500"
          >
            <Plus className="h-3.5 w-3.5" />
            New Collection
          </button>
        )}
      </div>

      {/* Collections Grid */}
      <div className="grid gap-3">
        {collections.map((c) => (
          <div
            key={c.id}
            className="group relative rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
          >
            <Link href={`/c/${c.id}`} className="block">
              <div className="flex items-center gap-2">
                {c.is_public ? (
                  <Globe className="h-3.5 w-3.5 text-neutral-400" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-neutral-400" />
                )}
                <div className="font-medium">{c.name}</div>
              </div>
              {c.description && (
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {c.description}
                </p>
              )}
            </Link>
            
            {isOwner && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete(c.id);
                }}
                className="absolute right-3 top-3 rounded-full p-1 text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-100 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-neutral-800"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}

        {collections.length === 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400">
            No collections yet.
            {isOwner && " Create your first collection!"}
          </div>
        )}
      </div>

      {/* Back link */}
      <div className="mt-6">
        <Link
          href={`/u/${profileHandle}`}
          className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white"
        >
          ← Back to profile
        </Link>
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-neutral-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Collection</h2>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
                  Name *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Collection name"
                  className={inputClass}
                  maxLength={100}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  className={`${inputClass} min-h-20 resize-none`}
                  maxLength={500}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
                  Visibility
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPublic(true)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm transition-colors ${
                      isPublic
                        ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                    Public
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublic(false)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm transition-colors ${
                      !isPublic
                        ? "border-violet-500 bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                        : "border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <Lock className="h-4 w-4" />
                    Private
                  </button>
                </div>
              </div>

              <button
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Collection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
