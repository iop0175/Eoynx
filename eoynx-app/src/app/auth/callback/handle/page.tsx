"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CallbackHandlePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth?error=" + encodeURIComponent("Invalid authentication callback"));
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="text-lg font-medium">Signing in...</div>
        <div className="mt-2 text-sm text-neutral-500">Please wait</div>
      </div>
    </div>
  );
}
