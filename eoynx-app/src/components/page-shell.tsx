export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">{subtitle}</p>
            ) : null}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
        {children ?? (
          <p className="text-sm text-neutral-600 dark:text-neutral-300">TODO: implement this page.</p>
        )}
      </div>
    </div>
  );
}
