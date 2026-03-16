"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { SearchCategory, SearchSortBy } from "@/app/actions/search";

type Option<T extends string> = {
  value: T;
  label: string;
};

type SearchFiltersPanelProps = {
  title: string;
  sortByLabel: string;
  categoryLabel: string;
  clearLabel: string;
  applyLabel: string;
  hasActiveFilters: boolean;
  loading: boolean;
  sortBy: SearchSortBy;
  category: SearchCategory;
  sortOptions: Option<SearchSortBy>[];
  categoryOptions: Option<SearchCategory>[];
  onSortChange: (value: SearchSortBy) => void;
  onCategoryChange: (value: SearchCategory) => void;
  onClear: () => void;
  onApply: () => void;
};

export function SearchFiltersPanel({
  title,
  sortByLabel,
  categoryLabel,
  clearLabel,
  applyLabel,
  hasActiveFilters,
  loading,
  sortBy,
  category,
  sortOptions,
  categoryOptions,
  onSortChange,
  onCategoryChange,
  onClear,
  onApply,
}: SearchFiltersPanelProps) {
  return (
    <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">{title}</h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
          >
            {clearLabel}
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {sortByLabel}
          </label>
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSortChange(opt.value)}
                aria-pressed={sortBy === opt.value}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  sortBy === opt.value
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {categoryLabel}
          </label>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onCategoryChange(opt.value)}
                aria-pressed={category === opt.value}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  category === opt.value
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button type="button" variant="neutral" onClick={onApply} disabled={loading}>
          {applyLabel}
        </Button>
      </div>
    </div>
  );
}
