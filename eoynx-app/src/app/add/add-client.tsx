"use client";

import * as React from "react";
import Link from "next/link";
import { X, Plus, Star } from "lucide-react";
import { Segmented } from "@/components/ui/segmented";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  UI_FIELD_ERROR,
  UI_FIELD_LABEL,
  uiInputClass,
} from "@/components/ui/ui-classes";
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

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_BRAND_LENGTH = 80;
const MAX_HASHTAGS = 15;
const MAX_HASHTAG_LENGTH = 30;
const MAX_PRICE_MINOR = 99_999_999_999; // 999,999,999.99 USD

type FieldErrors = Partial<Record<"images" | "category" | "brand" | "title" | "description" | "hashtags" | "price", string>>;

export default function AddClientPage() {
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
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});

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

    const remaining = MAX_IMAGES - pendingFiles.length;
    if (remaining <= 0) {
      setFieldErrors((prev) => ({ ...prev, images: `Maximum ${MAX_IMAGES} images allowed` }));
      setError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    const incoming = Array.from(files).slice(0, remaining);
    const validFiles: File[] = [];

    for (const file of incoming) {
      if (!file.type.startsWith("image/")) {
        setFieldErrors((prev) => ({ ...prev, images: "Only image files are allowed" }));
        setError("Only image files are allowed");
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setFieldErrors((prev) => ({ ...prev, images: "Each image must be smaller than 5MB" }));
        setError("Each image must be smaller than 5MB");
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    setFieldErrors((prev) => ({ ...prev, images: undefined }));
    setPendingFiles((prev) => [...prev, ...validFiles]);
    setError(null);

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

  const clearFieldError = (field: keyof FieldErrors) => {
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: FieldErrors = {};

    const titleTrimmed = title.trim();
    const descriptionTrimmed = description.trim();
    const brandTrimmed = brand.trim();
    const parsedHashtags = parseHashtags(hashtags);
    const parsedPrice = price.trim() ? parsePrice(price) : undefined;

    if (!titleTrimmed) {
      nextErrors.title = "Please enter an item name";
    } else if (titleTrimmed.length > MAX_TITLE_LENGTH) {
      nextErrors.title = `Item name must be ${MAX_TITLE_LENGTH} characters or fewer`;
    }

    if (pendingFiles.length === 0) {
      nextErrors.images = "Please add at least one image";
    } else if (pendingFiles.length > MAX_IMAGES) {
      nextErrors.images = `Maximum ${MAX_IMAGES} images allowed`;
    }

    if (category && !CATEGORIES.includes(category)) {
      nextErrors.category = "Please select a valid category";
    }

    if (brandTrimmed.length > MAX_BRAND_LENGTH) {
      nextErrors.brand = `Brand must be ${MAX_BRAND_LENGTH} characters or fewer`;
    }

    if (descriptionTrimmed.length > MAX_DESCRIPTION_LENGTH) {
      nextErrors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`;
    }

    if (parsedHashtags.length > MAX_HASHTAGS) {
      nextErrors.hashtags = `You can add up to ${MAX_HASHTAGS} hashtags`;
    } else if (parsedHashtags.some((tag) => tag.length > MAX_HASHTAG_LENGTH)) {
      nextErrors.hashtags = `Each hashtag must be ${MAX_HASHTAG_LENGTH} characters or fewer`;
    }

    if (price.trim() && parsedPrice === undefined) {
      nextErrors.price = "Please enter a valid price";
    } else if (parsedPrice !== undefined && (parsedPrice < 0 || parsedPrice > MAX_PRICE_MINOR)) {
      nextErrors.price = "Price is out of allowed range";
    }

    return {
      isValid: Object.keys(nextErrors).length === 0,
      errors: nextErrors,
      normalized: {
        title: titleTrimmed,
        description: descriptionTrimmed || undefined,
        brand: brandTrimmed || undefined,
        hashtags: parsedHashtags,
        priceMinor: parsedPrice,
      },
    };
  };

  // Create item
  const handlePublish = async () => {
    const validation = validateForm();
    if (!validation.isValid) {
      setFieldErrors(validation.errors);
      const firstError = Object.values(validation.errors).find(Boolean);
      setError(firstError || "Please check required fields");
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
        title: validation.normalized.title,
        description: validation.normalized.description,
        visibility,
        imageUrls: uploadedUrls,
        category: category || undefined,
        brand: validation.normalized.brand,
        hashtags: validation.normalized.hashtags,
        priceMinor: validation.normalized.priceMinor,
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

  const getInputClass = (field?: keyof FieldErrors) =>
    uiInputClass({ invalid: !!(field && fieldErrors[field]) });

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
          <Alert tone="error" className="mb-4">
            {error}
          </Alert>
        )}

        <div className="grid gap-4">
          {/* Image Management */}
          <div>
            <label className={UI_FIELD_LABEL}>
              Images ({pendingFiles.length}/{MAX_IMAGES})
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
              {pendingFiles.length < MAX_IMAGES && pendingFiles.length > 0 && (
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
            {fieldErrors.images && (
              <p className={UI_FIELD_ERROR}>{fieldErrors.images}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className={UI_FIELD_LABEL}>
              Category
            </label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                clearFieldError("category");
                setError(null);
              }}
              className={getInputClass("category")}
            >
              <option value="">Select category</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {fieldErrors.category && (
              <p className={UI_FIELD_ERROR}>{fieldErrors.category}</p>
            )}
          </div>

          {/* Brand */}
          <div>
            <label className={UI_FIELD_LABEL}>
              Brand
            </label>
            <input
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                clearFieldError("brand");
                setError(null);
              }}
              placeholder="HERMÈS"
              className={getInputClass("brand")}
            />
            {fieldErrors.brand && (
              <p className={UI_FIELD_ERROR}>{fieldErrors.brand}</p>
            )}
          </div>

          {/* Item name */}
          <div>
            <label className={UI_FIELD_LABEL}>
              Item name
            </label>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                clearFieldError("title");
                setError(null);
              }}
              placeholder="Birkin 25"
              maxLength={MAX_TITLE_LENGTH}
              className={getInputClass("title")}
            />
            {fieldErrors.title && (
              <p className={UI_FIELD_ERROR}>{fieldErrors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className={UI_FIELD_LABEL}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearFieldError("description");
                setError(null);
              }}
              placeholder="Description (optional)"
              maxLength={MAX_DESCRIPTION_LENGTH}
              className={`${getInputClass("description")} min-h-20 resize-none`}
            />
            {fieldErrors.description && (
              <p className={UI_FIELD_ERROR}>{fieldErrors.description}</p>
            )}
          </div>

          {/* Hashtags */}
          <div>
            <label className={UI_FIELD_LABEL}>
              Hashtags
            </label>
            <input
              value={hashtags}
              onChange={(e) => {
                setHashtags(e.target.value);
                clearFieldError("hashtags");
                setError(null);
              }}
              placeholder="#luxury #birkin"
              className={getInputClass("hashtags")}
            />
            {fieldErrors.hashtags && (
              <p className={UI_FIELD_ERROR}>{fieldErrors.hashtags}</p>
            )}
          </div>

          {/* Price */}
          <div>
            <label className={UI_FIELD_LABEL}>
              Price
            </label>
            <input
              value={price}
              onChange={(e) => {
                setPrice(e.target.value);
                clearFieldError("price");
                setError(null);
              }}
              placeholder="$16,000 (optional)"
              className={getInputClass("price")}
            />
            {fieldErrors.price && (
              <p className={UI_FIELD_ERROR}>{fieldErrors.price}</p>
            )}
          </div>

          {/* Visibility */}
          <div>
            <label className={UI_FIELD_LABEL}>
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
          <Button
            onClick={handlePublish}
            disabled={!title.trim() || pendingFiles.length === 0 || loading}
            variant="primary"
            size="lg"
            fullWidth
          >
            {uploading ? "Uploading images..." : loading ? "Creating..." : "Publish"}
          </Button>
        </div>
      </div>
    </div>
  );
}
