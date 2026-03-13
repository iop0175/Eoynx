import Link from "next/link";
import type { Metadata } from "next";
import { NOINDEX } from "@/lib/robots";
import { PageShell } from "@/components/page-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { buttonClass } from "@/components/ui/button";
import { updateDMOpenSetting } from "@/app/actions/profile";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "next-intl/server";
import { UI_SECTION_CARD, UI_SECTION_TITLE } from "@/components/ui/ui-classes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return {
    title: t("title"),
    robots: NOINDEX,
  };
}

export default async function SettingsPage() {
  const t = await getTranslations("settings");
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("dm_open").eq("id", user.id).maybeSingle()
    : { data: null };
  const isDMOpen = profile?.dm_open ?? true;

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")}>
      <div className="grid gap-4">
        {/* Profile Section */}
        {user && (
          <div className={UI_SECTION_CARD}>
            <div className={UI_SECTION_TITLE}>{t("profileSection")}</div>
            <Link
              href="/settings/profile"
              className={buttonClass({ variant: "secondary" })}
            >
              {t("editProfile")}
            </Link>
          </div>
        )}

        {/* Account Section */}
        <div className={UI_SECTION_CARD}>
          <div className={UI_SECTION_TITLE}>{t("accountSection")}</div>
          {user ? (
            <div className="grid gap-3">
              <div className="text-sm">
                <div className="text-neutral-500 dark:text-neutral-400">{t("emailLabel")}</div>
                <div className="font-medium">{user.email}</div>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className={buttonClass({
                    variant: "secondary",
                    className:
                      "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300 dark:hover:bg-red-900/40",
                  })}
                >
                  {t("signOut")}
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/auth"
              className={buttonClass({ variant: "neutral" })}
            >
              {t("signIn")}
            </Link>
          )}
        </div>

        {/* Language Section */}
        <div className={UI_SECTION_CARD}>
          <div className={UI_SECTION_TITLE}>{t("language")}</div>
          <LanguageSwitcher />
        </div>

        {/* Privacy & Safety Section */}
        {user && (
          <div className={UI_SECTION_CARD}>
            <div className={UI_SECTION_TITLE}>개인 정보 보호 및 안전</div>
            <Link
              href="/settings/blocked"
              className={buttonClass({ variant: "secondary" })}
            >
              차단된 사용자 관리
            </Link>
          </div>
        )}

        {/* Other Settings */}
        <div className={UI_SECTION_CARD}>
          <div className={UI_SECTION_TITLE}>{t("otherSection")}</div>
          <ul className="mb-4 list-disc pl-5 text-sm text-neutral-700 dark:text-neutral-200">
            <li>{t("theme")}</li>
            <li>{t("privacy")}</li>
          </ul>
          {user && (
            <div className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-700">
              <div className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">DM Mode</div>
              <div className="flex items-center gap-2">
                <form action={updateDMOpenSetting}>
                  <input type="hidden" name="dm_open" value="true" />
                  <button
                    type="submit"
                    className={buttonClass({
                      variant: isDMOpen ? "neutral" : "secondary",
                      size: "sm",
                    })}
                  >
                    Open
                  </button>
                </form>
                <form action={updateDMOpenSetting}>
                  <input type="hidden" name="dm_open" value="false" />
                  <button
                    type="submit"
                    className={buttonClass({
                      variant: !isDMOpen ? "neutral" : "secondary",
                      size: "sm",
                    })}
                  >
                    Request Required
                  </button>
                </form>
              </div>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Open: DM 즉시 가능 / Request Required: 요청 수락 후 메시지 가능
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
