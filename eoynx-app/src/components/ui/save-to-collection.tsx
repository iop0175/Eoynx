"use client";

import * as React from "react";
import { FolderPlus, Check, X, Plus } from "lucide-react";
import { 
  getUserCollections, 
  addItemToCollection, 
  removeItemFromCollection,
  createCollection,
} from "@/app/actions/collections";

type SaveToCollectionProps = {
  itemId: string;
  initialInCollections?: { id: string; name: string }[];
  isLoggedIn: boolean;
};

export function SaveToCollection({ itemId, initialInCollections = [], isLoggedIn }: SaveToCollectionProps) {
  const [showModal, setShowModal] = React.useState(false);
  const [collections, setCollections] = React.useState<{ id: string; name: string; is_public: boolean }[]>([]);
  const [inCollections, setInCollections] = React.useState<Set<string>>(
    new Set(initialInCollections.map((c) => c.id))
  );
  const [loading, setLoading] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const loadCollections = async () => {
    setLoading(true);
    const result = await getUserCollections();
    setCollections(result.collections);
    setLoading(false);
  };

  const handleOpen = () => {
    if (!isLoggedIn) {
      window.location.href = "/auth";
      return;
    }
    setShowModal(true);
    loadCollections();
  };

  const handleToggle = async (collectionId: string) => {
    const isIn = inCollections.has(collectionId);
    
    if (isIn) {
      const result = await removeItemFromCollection(collectionId, itemId);
      if (result.success) {
        setInCollections((prev) => {
          const next = new Set(prev);
          next.delete(collectionId);
          return next;
        });
      }
    } else {
      const result = await addItemToCollection(collectionId, itemId);
      if (result.success) {
        setInCollections((prev) => new Set([...prev, collectionId]));
      }
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    
    setCreating(true);
    const result = await createCollection({ name: newName.trim() });
    
    if (result.success && result.id) {
      // Add to collections list
      setCollections([{ id: result.id, name: newName.trim(), is_public: true }, ...collections]);
      // Also add item to this new collection
      await addItemToCollection(result.id, itemId);
      setInCollections((prev) => new Set([...prev, result.id!]));
      setNewName("");
      setShowCreate(false);
    }
    setCreating(false);
  };

  const savedCount = inCollections.size;

  return (
    <>
      <button
        onClick={handleOpen}
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
          savedCount > 0
            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
        }`}
      >
        <FolderPlus className="h-3.5 w-3.5" />
        {savedCount > 0 ? `Saved (${savedCount})` : "Save"}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div 
            className="absolute inset-0 bg-black/50" 
            onClick={() => setShowModal(false)} 
          />
          <div className="relative max-h-[80vh] w-full max-w-sm overflow-hidden rounded-t-2xl bg-white dark:bg-neutral-900 sm:rounded-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 p-4 dark:border-neutral-800">
              <h3 className="font-semibold">Save to Collection</h3>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-full p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Create new */}
            <div className="border-b border-neutral-200 p-4 dark:border-neutral-800">
              {showCreate ? (
                <div className="flex gap-2">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="New collection name"
                    className="flex-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm placeholder-neutral-400 focus:border-violet-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
                    onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                    autoFocus
                  />
                  <button
                    onClick={handleCreate}
                    disabled={!newName.trim() || creating}
                    className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {creating ? "..." : "Add"}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreate(false);
                      setNewName("");
                    }}
                    className="rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-neutral-300 p-3 text-sm text-neutral-600 hover:border-violet-500 hover:text-violet-600 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-violet-400 dark:hover:text-violet-400"
                >
                  <Plus className="h-4 w-4" />
                  Create new collection
                </button>
              )}
            </div>

            {/* Collections list */}
            <div className="max-h-64 overflow-y-auto p-2">
              {loading ? (
                <div className="p-4 text-center text-sm text-neutral-500">Loading...</div>
              ) : collections.length === 0 ? (
                <div className="p-4 text-center text-sm text-neutral-500">
                  No collections yet. Create one above!
                </div>
              ) : (
                collections.map((collection) => {
                  const isIn = inCollections.has(collection.id);
                  return (
                    <button
                      key={collection.id}
                      onClick={() => handleToggle(collection.id)}
                      className="flex w-full items-center justify-between rounded-lg p-3 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      <span>{collection.name}</span>
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                          isIn
                            ? "border-violet-500 bg-violet-500 text-white"
                            : "border-neutral-300 dark:border-neutral-600"
                        }`}
                      >
                        {isIn && <Check className="h-3 w-3" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
