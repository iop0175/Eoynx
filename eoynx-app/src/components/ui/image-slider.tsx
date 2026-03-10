"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ImageSliderProps = {
  images: string[];
  alt: string;
};

export function ImageSlider({ images, alt }: ImageSliderProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  if (images.length === 0) {
    return (
      <div className="flex h-72 w-full items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-800">
        <span className="text-4xl">📦</span>
      </div>
    );
  }

  if (images.length === 1) {
    return (
      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[0]}
          alt={alt}
          className="h-72 w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Main Image */}
      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[currentIndex]}
          alt={`${alt} ${currentIndex + 1}`}
          className="h-72 w-full object-cover"
        />
      </div>

      {/* Navigation Arrows */}
      <button
        type="button"
        onClick={goToPrevious}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
        aria-label="Previous image"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={goToNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
        aria-label="Next image"
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
        {images.map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => goToSlide(index)}
            className={`h-2 w-2 rounded-full transition-colors ${
              index === currentIndex
                ? "bg-white"
                : "bg-white/50 hover:bg-white/70"
            }`}
            aria-label={`Go to image ${index + 1}`}
          />
        ))}
      </div>

      {/* Image Counter */}
      <div className="absolute right-3 top-3 rounded-md bg-black/50 px-2 py-1 text-xs font-medium text-white">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}
