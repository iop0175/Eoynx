"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Plus, Star } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { uploadItemImage, createItem } from "@/app/actions/item";

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

export default function AddClientPage() {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Image state
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);

  // Form state
  const [category, setCategory] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [hashtags, setHashtags] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [visibility, setVisibility] = React.useState<"public" | "unlisted" | "private">("public");

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Create preview URLs for files
  React.useEffect(() => {
    const urls = pendingFiles.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [pendingFiles]);

  // Add images
  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remaining = 5 - pendingFiles.length;
    if (remaining <= 0) {
      setError("Maximum 5 images allowed");
      return;
    }

    const newFiles = Array.from(files).slice(0, remaining);
    setPendingFiles((prev) => [...prev, ...newFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Remove image
  const handleRemoveImage = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Set as primary (move to first position)
  const handleSetPrimary = (index: number) => {
    if (index === 0) return;
    setPendingFiles((prev) => {
      const newFiles = [...prev];
      const [removed] = newFiles.splice(index, 1);
      newFiles.unshift(removed);
      return newFiles;
    });
  };

  // Parse hashtags
  const parseHashtags = (input: string): string[] => {
    return input
      .split(/[\s,]+/)
      .map((tag) => tag.replace(/^#/, "").trim())
      .filter((tag) => tag.length > 0);
  };

  // Parse price (dollars → cents)
  const parsePrice = (input: string): number | undefined => {
    const cleaned = input.replace(/[^0-9.]/g, "");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return undefined;
    return Math.round(num * 100);
  };

  // Create item
  const handlePublish = async () => {
    if (!title.trim()) {
      setError("Please enter an item name");
      return;
    }

    if (pendingFiles.length === 0) {
      setError("Please add at least one image");
      return;
    }

    setLoading(true);
    setUploading(true);
    setError(null);

    try {
      // Upload all images first
      const uploadedUrls: string[] = [];

      for (const file of pendingFiles) {
        const formData = new FormData();
        formData.append("file", file);

        const result = await uploadItemImage(formData);

        if (result.error) {
          setError(result.error);
          setLoading(false);
          setUploading(false);
          return;
        }

        if (result.url) {
          uploadedUrls.push(result.url);
        }
      }

      setUploading(false);

      // Create the item
      const result = await createItem({
        title: title.trim(),
        description: description.trim() || undefined,
        visibility,
        imageUrls: uploadedUrls,
        category: category || undefined,
        brand: brand.trim() || undefined,
        hashtags: parseHashtags(hashtags),
        priceMinor: parsePrice(price),
        priceCurrency: "USD",
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
      }
      // Success: createItem handles redirect
    } catch (e) {
      setError("Failed to create item");
      console.error(e);
      setLoading(false);
      setUploading(false);
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
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Add item</h1>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              Create a new item in your collection
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
          >
            Cancel
          </Link>
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
              Images ({pendingFiles.length}/5)
            </label>

            {/* Primary Image */}
            <div className="mb-3">
              {previewUrls.length > 0 ? (
                <div className="group relative aspect-square w-full overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrls[0]}
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
              {previewUrls.slice(1).map((url, idx) => (
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
              {pendingFiles.length < 5 && pendingFiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex aspect-square w-20 items-center justify-center rounded-lg border-2 border-dashed border-neutral-200 text-neutral-400 transition-colors hover:border-neutral-300 hover:text-neutral-500 dark:border-neutral-800 dark:hover:border-neutral-700"
                >
                  <Plus className="h-5 w-5" />
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

          {/* Publish Button */}
          <button
            type="button"
            onClick={handlePublish}
            disabled={!title.trim() || pendingFiles.length === 0 || loading}
            className="w-full rounded-xl bg-violet-600 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50 dark:bg-violet-500 dark:hover:bg-violet-400"
          >
            {uploading ? "Uploading images..." : loading ? "Creating..." : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
