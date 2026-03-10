"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from "@/app/actions/auth";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = React.useState<"signin" | "signup">("signin");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // URL에서 에러 파라미터 확인
  React.useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  // URL hash에서 토큰 처리 (Implicit flow)
  React.useEffect(() => {
    const handleHashTokens = async () => {
      const hash = window.location.hash;
      console.log("Auth hash check:", hash ? "has hash" : "no hash");
      
      if (hash && hash.includes("access_token")) {
        console.log("Processing access_token from hash");
        setLoading(true);
        setError(null);
        
        // Hash를 파싱하여 토큰 추출
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        
        console.log("Tokens found:", { hasAccess: !!accessToken, hasRefresh: !!refreshToken });
        
        if (!accessToken || !refreshToken) {
          setError("Invalid authentication response");
          setLoading(false);
          return;
        }

        const supabase = createSupabaseBrowserClient();

        // 세션을 명시적으로 설정
        console.log("Setting session...");
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        console.log("setSession result:", { hasData: !!data, error: sessionError?.message });
        
        if (sessionError) {
          setError(sessionError.message);
          setLoading(false);
          return;
        }

        console.log("Redirecting to /feed...");
        // 쿠키가 설정될 때까지 잠시 대기 후 리다이렉트
        setTimeout(() => {
          window.location.href = "/feed";
        }, 500);
      }
    };

    handleHashTokens();
  }, []);

  async function handleEmailSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = mode === "signin" 
      ? await signInWithEmail(formData)
      : await signUpWithEmail(formData);

    if (result && "error" in result && result.error) {
      setError(result.error);
    }
    if (result && "success" in result && result.success) {
      setSuccess(result.success);
    }
    setLoading(false);
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError(null);
    const result = await signInWithGoogle();
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      {/* Google Sign In */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:bg-black dark:text-white dark:hover:bg-neutral-900"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {loading ? "Loading..." : "Continue with Google"}
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-white px-2 text-neutral-500 dark:bg-black dark:text-neutral-400">
            or
          </span>
        </div>
      </div>

      {/* Email Form */}
      <form action={handleEmailSubmit} className="grid gap-3">
        <input
          name="email"
          type="email"
          placeholder="Email"
          required
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 dark:border-neutral-800 dark:bg-black dark:focus:border-neutral-700"
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          required
          minLength={6}
          className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 dark:border-neutral-800 dark:bg-black dark:focus:border-neutral-700"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-neutral-900 px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {loading ? "Loading..." : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200">
          {success}
        </div>
      )}

      <div className="text-center text-sm text-neutral-600 dark:text-neutral-400">
        {mode === "signin" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("signup")}
              className="font-medium text-neutral-900 hover:underline dark:text-white"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => setMode("signin")}
              className="font-medium text-neutral-900 hover:underline dark:text-white"
            >
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
