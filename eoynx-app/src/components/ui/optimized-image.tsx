"use client";

import * as React from "react";
import Image, { type ImageProps } from "next/image";

type OptimizedImageProps = Omit<ImageProps, "src"> & {
  src: string | null | undefined;
  fallback?: React.ReactNode;
  aspectRatio?: "square" | "4/3" | "16/9" | "9/16" | "custom";
};

/**
 * OptimizedImage - Wrapper for Next.js Image with fallback support
 * 
 * Uses Next.js Image for automatic:
 * - WebP/AVIF conversion
 * - Responsive sizing
 * - Lazy loading
 * - Blur placeholder (when blurDataURL provided)
 */
export function OptimizedImage({
  src,
  alt,
  fallback,
  aspectRatio = "square",
  className = "",
  fill,
  ...props
}: OptimizedImageProps) {
  const [error, setError] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  // Reset error state when src changes
  React.useEffect(() => {
    setError(false);
    setLoaded(false);
  }, [src]);

  // Handle missing or invalid src
  if (!src || error) {
    return fallback ?? (
      <div 
        className={`flex items-center justify-center bg-neutral-100 text-4xl dark:bg-neutral-800 ${className}`}
        style={getAspectRatioStyle(aspectRatio, fill)}
      >
        📦
      </div>
    );
  }

  return (
    <div 
      className={`relative overflow-hidden ${!fill ? getAspectRatioClass(aspectRatio) : ""} ${className}`}
      style={fill ? undefined : getAspectRatioStyle(aspectRatio, fill)}
    >
      {/* Loading skeleton */}
      {!loaded && (
        <div className="absolute inset-0 animate-pulse bg-neutral-200 dark:bg-neutral-800" />
      )}
      
      <Image
        src={src}
        alt={alt}
        fill={fill ?? true}
        className={`object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        sizes={props.sizes ?? getSizesDefault(aspectRatio)}
        {...props}
      />
    </div>
  );
}

function getAspectRatioClass(ratio: OptimizedImageProps["aspectRatio"]): string {
  switch (ratio) {
    case "square": return "aspect-square";
    case "4/3": return "aspect-[4/3]";
    case "16/9": return "aspect-video";
    case "9/16": return "aspect-[9/16]";
    default: return "";
  }
}

function getAspectRatioStyle(
  ratio: OptimizedImageProps["aspectRatio"],
  fill?: boolean
): React.CSSProperties | undefined {
  if (fill) return { position: "relative", width: "100%", height: "100%" };
  return undefined;
}

function getSizesDefault(ratio: OptimizedImageProps["aspectRatio"]): string {
  // Default responsive sizes based on common layouts
  return "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw";
}

/**
 * Avatar - Optimized circular avatar image
 */
type AvatarProps = {
  src: string | null | undefined;
  alt: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  fallbackInitial?: string;
};

const avatarSizes = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

const avatarPixelSizes = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

export function Avatar({ src, alt, size = "md", className = "", fallbackInitial }: AvatarProps) {
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    setError(false);
  }, [src]);

  const sizeClass = avatarSizes[size];
  const pixelSize = avatarPixelSizes[size];
  const initial = fallbackInitial ?? alt.charAt(0).toUpperCase();

  if (!src || error) {
    return (
      <div 
        className={`flex shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 ${sizeClass} ${className}`}
      >
        <span style={{ fontSize: pixelSize * 0.4 }}>{initial}</span>
      </div>
    );
  }

  return (
    <div className={`relative shrink-0 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800 ${sizeClass} ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={pixelSize}
        height={pixelSize}
        className="h-full w-full object-cover"
        onError={() => setError(true)}
      />
    </div>
  );
}

/**
 * ItemImage - Optimized image for item cards
 */
type ItemImageProps = {
  src: string | null | undefined;
  alt: string;
  priority?: boolean;
  className?: string;
};

export function ItemImage({ src, alt, priority = false, className = "" }: ItemImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      aspectRatio="square"
      priority={priority}
      className={`bg-neutral-100 dark:bg-neutral-900 ${className}`}
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
    />
  );
}

/**
 * FeedImage - Optimized image for feed cards (4:3 aspect ratio)
 */
type FeedImageProps = {
  src: string | null | undefined;
  alt: string;
  priority?: boolean;
  className?: string;
};

export function FeedImage({ src, alt, priority = false, className = "" }: FeedImageProps) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      aspectRatio="4/3"
      priority={priority}
      className={`bg-neutral-100 dark:bg-neutral-900 ${className}`}
      sizes="(max-width: 768px) 100vw, 768px"
    />
  );
}
