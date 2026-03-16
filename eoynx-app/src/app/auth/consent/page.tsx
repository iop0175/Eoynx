import { NOINDEX } from "@/lib/robots";
import { PageShell } from "@/components/page-shell";
import { acceptPrivacyConsent } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { buttonClass } from "@/components/ui/button";

export const metadata = {
  title: "개인정보 동의",
  robots: NOINDEX,
};

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

export default async function AuthConsentPage({ searchParams }: Props) {
  const params = await searchParams;
  const nextPath = params.next && params.next.startsWith("/") ? params.next : "/feed";

  return (
    <PageShell title="개인정보 수집·이용 동의" subtitle="회원가입 완료를 위해 동의가 필요합니다.">
      <div className="grid gap-4">
        {params.error && <Alert tone="error">{params.error}</Alert>}

        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          Google로 처음 가입한 계정은 개인정보 수집 및 이용 동의가 필요합니다.
        </p>

        <form action={acceptPrivacyConsent} className="grid gap-3">
          <input type="hidden" name="next" value={nextPath} />
          <label className="flex items-start gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
            <input name="privacyConsent" type="checkbox" value="yes" required className="mt-0.5 h-4 w-4" />
            <span>
              개인정보 수집 및 이용에 동의합니다. {" "}
              <a
                href="/privacy-consent"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-neutral-900 underline underline-offset-2 dark:text-white"
              >
                동의서 보기
              </a>
              <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">(필수)</span>
            </span>
          </label>

          <button type="submit" className={buttonClass({ variant: "neutral" })}>
            동의하고 계속
          </button>
        </form>
      </div>
    </PageShell>
  );
}
