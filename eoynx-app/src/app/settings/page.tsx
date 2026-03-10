import Link from "next/link";
import { NOINDEX } from "@/lib/robots";
import { PageShell } from "@/components/page-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "next-intl/server";

export const metadata = {
  title: "Settings",
  robots: NOINDEX,
};

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")}>
      <div className="grid gap-4">
        {/* Profile Section */}
        {user && (
          <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
            <div className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Profile</div>
            <Link
              href="/settings/profile"
              className="inline-block rounded-xl border border-neutral-200 px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Edit Profile
            </Link>
          </div>
        )}

        {/* Account Section */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
          <div className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Account</div>
          {user ? (
            <div className="grid gap-3">
              <div className="text-sm">
                <div className="text-neutral-500 dark:text-neutral-400">Email</div>
                <div className="font-medium">{user.email}</div>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/40"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/auth"
              className="inline-block rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Language Section */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
          <div className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">{t("language")}</div>
          <LanguageSwitcher />
        </div>

        {/* Other Settings */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-black">
          <div className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">Other</div>
          <ul className="list-disc pl-5 text-sm text-neutral-700 dark:text-neutral-200">
            <li>Theme (in top bar)</li>
            <li>DM settings (followers-only toggle)</li>
            <li>Privacy + blocks</li>
          </ul>
        </div>
      </div>
    </PageShell>
  );
}
