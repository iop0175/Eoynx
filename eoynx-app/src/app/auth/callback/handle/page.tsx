"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

export default function CallbackHandlePage() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      // URL fragment에서 토큰 추출
      const hash = window.location.hash;
      
      if (hash) {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // Supabase는 자동으로 URL fragment의 토큰을 처리함
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          router.push(`/auth?error=${encodeURIComponent(error.message)}`);
          return;
        }

        if (data.session) {
          router.push("/feed");
          return;
        }
      }

      // 세션이 없으면 auth 페이지로
      router.push("/auth");
    };

    handleCallback();
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
