import { Suspense } from "react";
import { redirect } from "next/navigation";
import { NOINDEX } from "@/lib/robots";
import { PageShell } from "@/components/page-shell";
import { AuthForm } from "./auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Sign in",
  robots: NOINDEX,
};

export default async function AuthPage() {
  // 디버그: 서버 측 세션 체크 (리다이렉트 임시 비활성화)
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  console.log("[Auth Page] Server-side user check:", user ? user.email : "no user");

  // 임시로 리다이렉트 비활성화 - 클라이언트에서 처리
  // if (user) {
  //   redirect("/feed");
  // }

  return (
    <PageShell title="Sign in" subtitle="Google + email/password.">
      <Suspense fallback={<div className="text-center">Loading...</div>}>
        <AuthForm />
      </Suspense>
    </PageShell>
  );
}
