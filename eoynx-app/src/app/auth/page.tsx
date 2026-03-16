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
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect("/feed");
  }

  return (
    <PageShell title="Sign in" subtitle="Google + email/password.">
      <Suspense fallback={<div className="text-center">Loading...</div>}>
        <AuthForm />
      </Suspense>
    </PageShell>
  );
}
