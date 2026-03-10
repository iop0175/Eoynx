"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Plus, Star } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { updateItem, deleteItem, uploadItemImage } from "@/app/actions/item";
import type { ItemWithOwner } from "@/lib/db-item";

const CATEGORIES = [
  "Luxury",
  "Electronics",
  "Fashion",
  "Art",
  "Collectibles",
  "Jewelry",
  "Watches",
  "Other",
];

type EditClientPageProps = {
  item: ItemWithOwner;
};

export default function EditClientPage({ item }: EditClientPageProps) {
  const router = useRouter();

  // Image state
  const initialImages = item.image_urls?.length 
    ? item.image_urls 
    : item.image_url 
    ? [item.image_url] 
    : [];
  const [imageUrls, setImageUrls] = React.useState<string[]>(initialImages);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Form state
  const [category, setCategory] = React.useState(item.category || "");
  const [brand, setBrand] = React.useState(item.brand || "");
  const [title, setTitle] = React.useState(item.title);
  const [description, setDescription] = React.useState(item.description || "");
  const [hashtags, setHashtags] = React.useState(item.hashtags?.join(" ") || "");
  const [price, setPrice] = React.useState(
    item.price_minor ? `$${(item.price_minor / 100).toLocaleString()}` : ""
  );
  const [visibility, setVisibility] = React.useState<"public" | "unlisted" | "private">(
    item.visibility
  );

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  // 이미지 제거
  const handleRemoveImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // 대표 이미지로 설정 (첫 번째로 이동)
  const handleSetPrimary = (index: number) => {
    if (index === 0) return;
    setImageUrls((prev) => {
      const newUrls = [...prev];
      const [removed] = newUrls.splice(index, 1);
      newUrls.unshift(removed);
      return newUrls;
    });
  };

  // 이미지 추가
  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = 5 - imageUrls.length;
    if (remaining <= 0) {
      setError("Maximum 5 images allowed");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const filesToUpload = Array.from(files).slice(0, remaining);
      const newUrls: string[] = [];

      for (const file of filesToUpload) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("itemId", item.id);

        const result = await uploadItemImage(formData);
        if (result.error) {
          setError(result.error);
          break;
        }
        if (result.url) {
          newUrls.push(result.url);
        }
      }

      setImageUrls((prev) => [...prev, ...newUrls]);
    } catch (err) {
      console.error(err);
      setError("Failed to upload images");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 해시태그 파싱
  const parseHashtags = (input: string): string[] => {
    return input
      .split(/[\s,]+/)
      .map((tag) => tag.replace(/^#/, "").trim())
      .filter((tag) => tag.length > 0);
  };

  // 가격 파싱 (달러 → 센트)
  const parsePrice = (input: string): number | undefined => {
    const cleaned = input.replace(/[^0-9.]/g, "");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return undefined;
    return Math.round(num * 100);
  };

  // 저장
  const handleSave = async () => {
    if (!title.trim()) {
      setError("Please enter an item name");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await updateItem({
        id: item.id,
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        imageUrls: imageUrls,
        category: category || undefined,
        brand: brand.trim() || undefined,
        hashtags: parseHashtags(hashtags),
        priceMinor: parsePrice(price),
        priceCurrency: "USD",
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      router.push(`/i/${item.id}`);
      router.refresh();
    } catch (e) {
      setError("Failed to update item");
      console.error(e);
      setLoading(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await deleteItem(item.id);

      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }
      // deleteItem에서 redirect 처리
    } catch (e) {
      setError("Failed to delete item");
      console.error(e);
      setLoading(false);
    }
  };

  const visibilityDescription = {
    public: "Public: visible on profile & searchable",
    unlisted: "Unlisted: only accessible via link",
    private: "Private: only visible to you",
  };

  const inputClass =
    "w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 dark:border-neutral-800 dark:bg-black dark:placeholder:text-neutral-600 dark:focus:border-neutral-700";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Edit item</h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              Update your item details
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/i/${item.id}`}
              className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          {/* Image Management */}
          <div>
            <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
              Images ({imageUrls.length}/5)
            </label>
            
            {/* Primary Image */}
            <div className="mb-3">
              {imageUrls.length > 0 ? (
                <div className="group relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrls[0]}
                    alt="Primary"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute left-2 top-2 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-medium text-white">
                    <Star className="mr-1 inline h-3 w-3" />
                    Primary
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveImage(0)}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50 text-neutral-400 transition-colors hover:border-neutral-300 hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                >
                  <Plus className="mb-2 h-8 w-8" />
                  <span className="text-sm">Add primary image</span>
                </div>
              )}
            </div>

            {/* Sub Images */}
            <div className="flex gap-2">
              {imageUrls.slice(1).map((url, idx) => (
                <div
                  key={url}
                  className="group relative aspect-square w-20 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Sub ${idx + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(idx + 1)}
                      className="rounded-full bg-white/90 p-1 text-neutral-800 hover:bg-white"
                      aria-label="Set as primary"
                      title="Set as primary"
                    >
                      <Star className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx + 1)}
                      className="rounded-full bg-white/90 p-1 text-red-600 hover:bg-white"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Add more button */}
              {imageUrls.length < 5 && imageUrls.length > 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex aspect-square w-20 items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-500 disabled:opacity-50 dark:border-neutral-800 dark:hover:border-neutral-700"
                >
                  {uploading ? (
                    <span className="text-xs">...</span>
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleAddImages}
              className="hidden"
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              <option value="">Select category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div>
            <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
              Brand
            </label>
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="HERMÈS"
              className={inputClass}
            />
          </div>

          {/* Item name */}
          <div>
            <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
              Item name
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Birkin 25"
              maxLength={100}
              className={inputClass}
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              maxLength={500}
              className={`${inputClass} min-h-20 resize-none`}
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
              Hashtags
            </label>
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#luxury #birkin"
              className={inputClass}
            />
          </div>

          {/* Price */}
          <div>
            <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
              Price
            </label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="$16,000 (optional)"
              className={inputClass}
            />
          </div>

          {/* Visibility */}
          <div>
            <label className="mb-1.5 block text-xs text-neutral-500 dark:text-neutral-400">
              Visibility
            </label>
            <Segmented
              value={visibility}
              onChange={(v) => setVisibility(v as typeof visibility)}
              options={[
                { value: "public", label: "Public" },
                { value: "unlisted", label: "Unlisted" },
                { value: "private", label: "Private" },
              ]}
            />
            <p className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
              {visibilityDescription[visibility]}
            </p>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || loading}
            className="w-full rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            {loading ? "Saving..." : "Save changes"}
          </button>

          {/* Delete Section */}
          <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full rounded-xl border border-red-200 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
              >
                Delete item
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-center text-sm text-neutral-600 dark:text-neutral-400">
                  Are you sure? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={loading}
                    className="flex-1 rounded-xl border border-neutral-200 py-3 text-sm font-medium transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                  >
                    {loading ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
