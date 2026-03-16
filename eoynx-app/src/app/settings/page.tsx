import Link from "next/link";
import type { Metadata } from "next";
import { NOINDEX } from "@/lib/robots";
import { PageShell } from "@/components/page-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteAccount, signOut } from "@/app/actions/auth";
import { buttonClass } from "@/components/ui/button";
import { updateDMOpenSetting } from "@/app/actions/profile";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getTranslations } from "next-intl/server";
import { UI_SECTION_CARD, UI_SECTION_TITLE } from "@/components/ui/ui-classes";
import { Alert } from "@/components/ui/alert";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return {
    title: t("title"),
    robots: NOINDEX,
  };
}

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const t = await getTranslations("settings");
  const params = await searchParams;
  const errorMessage = params.error;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("dm_open").eq("id", user.id).maybeSingle()
    : { data: null };
  const isDMOpen = profile?.dm_open ?? true;

  return (
    <PageShell title={t("title")} subtitle={t("subtitle")}>
      <div className="grid gap-4">
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

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
              <form action={deleteAccount}>
                <label className="mb-2 block text-xs text-neutral-500 dark:text-neutral-400">
                  {t("deleteAccountConfirmLabel")}
                </label>
                <input
                  name="confirmText"
                  type="text"
                  required
                  placeholder="DELETE"
                  className="mb-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-neutral-300 placeholder:text-neutral-400 focus:ring-2 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:ring-neutral-700"
                />
                <button
                  type="submit"
                  className={buttonClass({
                    variant: "secondary",
                    className:
                      "border-red-300 bg-red-100 text-red-800 hover:bg-red-200 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/60",
                  })}
                >
                  {t("deleteAccount")}
                </button>
              </form>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t("deleteAccountHint")}</p>
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
              <div className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">DM 수신 설정</div>
              <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
                기본값은 Open이며, 원하면 승인 후 DM으로 전환할 수 있습니다.
              </p>
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
                    Open (기본)
                  </button>
                </form>
                <form action={updateDMOpenSetting}>
                  <input type="hidden" name="dm_mode" value="request" />
                  <button
                    type="submit"
                    className={buttonClass({
                      variant: !isDMOpen ? "neutral" : "secondary",
                      size: "sm",
                    })}
                  >
                    승인 후 DM
                  </button>
                </form>
              </div>
              <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                Open: 바로 대화 시작 가능 / 승인 후 DM: 요청 수락 뒤 메시지 가능
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
