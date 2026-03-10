"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";

export type ImageFile = {
  file: File;
  previewUrl: string;
};

type MultiImageUploadProps = {
  images: ImageFile[];
  onImagesChange: (images: ImageFile[]) => void;
  maxImages?: number;
  disabled?: boolean;
};

export function MultiImageUpload({
  images,
  onImagesChange,
  maxImages = 5,
  disabled = false,
}: MultiImageUploadProps) {
  const primaryInputRef = React.useRef<HTMLInputElement>(null);
  const subInputRef = React.useRef<HTMLInputElement>(null);

  const handlePrimarySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.type.startsWith("image/")) {
      const newImage: ImageFile = {
        file,
        previewUrl: URL.createObjectURL(file),
      };
      
      // Replace first image or add as first
      if (images.length > 0) {
        URL.revokeObjectURL(images[0].previewUrl);
        onImagesChange([newImage, ...images.slice(1)]);
      } else {
        onImagesChange([newImage]);
      }
    }

    if (primaryInputRef.current) {
      primaryInputRef.current.value = "";
    }
  };

  const handleSubSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: ImageFile[] = [];
    const remainingSlots = maxImages - images.length;

    for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        newImages.push({
          file,
          previewUrl: URL.createObjectURL(file),
        });
      }
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
    }

    if (subInputRef.current) {
      subInputRef.current.value = "";
    }
  };

  const handleRemove = (index: number) => {
    const newImages = [...images];
    URL.revokeObjectURL(newImages[index].previewUrl);
    newImages.splice(index, 1);
    onImagesChange(newImages);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePrimaryDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    if (file.type.startsWith("image/")) {
      const newImage: ImageFile = {
        file,
        previewUrl: URL.createObjectURL(file),
      };

      if (images.length > 0) {
        URL.revokeObjectURL(images[0].previewUrl);
        onImagesChange([newImage, ...images.slice(1)]);
      } else {
        onImagesChange([newImage]);
      }
    }
  };

  const primaryImage = images[0];
  const subImages = images.slice(1);
  const canAddSub = images.length > 0 && images.length < maxImages && !disabled;

  return (
    <div className="space-y-4">
      {/* Primary image - large area */}
      <div
        onClick={() => !disabled && primaryInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDrop={handlePrimaryDrop}
        className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
          primaryImage
            ? "border-transparent"
            : "border-neutral-300 bg-neutral-50/50 hover:border-neutral-400 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900/50 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
        }`}
      >
        {primaryImage ? (
          <div className="group relative aspect-[4/3]">
            <img
              src={primaryImage.previewUrl}
              alt="Primary"
              className="h-full w-full object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(0);
                }}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
              Primary
            </div>
          </div>
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center px-4 py-12 text-center">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Add photos (up to {maxImages})
            </p>
          </div>
        )}
      </div>

      {/* Sub images - horizontal row */}
      {images.length > 0 && (
        <div className="flex gap-2">
          {subImages.map((img, index) => (
            <div
              key={img.previewUrl}
              className="group relative aspect-square h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl"
            >
              <img
                src={img.previewUrl}
                alt={`Sub ${index + 1}`}
                className="h-full w-full object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(index + 1)}
                  className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {/* Add sub image button */}
          {canAddSub && (
            <button
              type="button"
              onClick={() => subInputRef.current?.click()}
              className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 text-neutral-400 transition-colors hover:border-neutral-400 hover:text-neutral-500 dark:border-neutral-700 dark:text-neutral-500 dark:hover:border-neutral-600 dark:hover:text-neutral-400"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* Hidden inputs */}
      <input
        ref={primaryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handlePrimarySelect}
        className="hidden"
      />
      <input
        ref={subInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        onChange={handleSubSelect}
        className="hidden"
      />
    </div>
  );
}
