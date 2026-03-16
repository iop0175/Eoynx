import { readFile } from "node:fs/promises";
import path from "node:path";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { NOINDEX } from "@/lib/robots";
import { PageShell } from "@/components/page-shell";

export const metadata = {
  title: "개인정보 수집·이용 동의서",
  robots: NOINDEX,
};

export default async function PrivacyConsentPage() {
  const consentPath = path.join(process.cwd(), "PRIVACY_CONSENT.ko.md");
  const consentText = await readFile(consentPath, "utf8");

  return (
    <PageShell title="개인정보 수집·이용 동의서" subtitle="회원가입 전 필수 확인 문서">
      <article className="text-neutral-800 dark:text-neutral-200">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ ...props }) => <h1 className="text-xl font-semibold tracking-tight" {...props} />,
            h2: ({ ...props }) => <h2 className="mt-6 text-lg font-semibold" {...props} />,
            h3: ({ ...props }) => <h3 className="mt-4 text-base font-semibold" {...props} />,
            p: ({ ...props }) => <p className="mt-3 text-sm leading-6" {...props} />,
            ul: ({ ...props }) => <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6" {...props} />,
            ol: ({ ...props }) => <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6" {...props} />,
            li: ({ ...props }) => <li className="marker:text-neutral-500" {...props} />,
            a: ({ ...props }) => (
              <a
                className="font-medium text-neutral-900 underline underline-offset-2 dark:text-white"
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            ),
            hr: ({ ...props }) => <hr className="my-6 border-neutral-200 dark:border-neutral-800" {...props} />,
            blockquote: ({ ...props }) => (
              <blockquote
                className="mt-4 border-l-2 border-neutral-300 pl-3 text-sm text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
                {...props}
              />
            ),
          }}
        >
          {consentText}
        </ReactMarkdown>
      </article>
    </PageShell>
  );
}
