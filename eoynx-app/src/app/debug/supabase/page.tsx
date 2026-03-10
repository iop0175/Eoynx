import { NOINDEX } from "@/lib/robots";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Supabase Debug",
  robots: NOINDEX,
};

export default async function SupabaseDebugPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getSession();

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Supabase Debug</h1>

      <div className="mt-4 rounded-lg border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <div className="font-medium">auth.getSession()</div>
        <pre className="mt-2 overflow-auto rounded-md bg-neutral-50 p-3 text-xs text-neutral-800 dark:bg-neutral-900 dark:text-neutral-100">
{JSON.stringify(
  {
    ok: !error,
    error: error ? { message: error.message } : null,
    session: data?.session
      ? {
          hasSession: true,
          userId: data.session.user?.id ?? null,
          email: data.session.user?.email ?? null,
        }
      : { hasSession: false },
  },
  null,
  2
)}
        </pre>
      </div>

      <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-300">
        If <code>ok</code> is true, env wiring is correct. (This page is noindex.)
      </p>
    </main>
  );
}
