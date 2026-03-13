"use client";

import { ErrorFallback } from "@/components/ui/error-fallback";

export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorFallback error={error} reset={reset} context="Feed" />;
}
