"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Theme = "system" | "light" | "dark";

type UserProfile = {
  handle: string;
  avatar_url: string | null;
} | null;

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;

  if (theme === "light") root.classList.remove("dark");
  if (theme === "dark") root.classList.add("dark");
  if (theme === "system") {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (mq.matches) root.classList.add("dark");
    else root.classList.remove("dark");
  }
}

function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}

function IconSearch(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function IconPlus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function IconDM(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

function IconSettings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
      <path d="M19.4 15a7.8 7.8 0 0 0 .1-1l2-1.5-2-3.5-2.4.7a7.6 7.6 0 0 0-1.7-1L15 6h-6l-.4 2.7a7.6 7.6 0 0 0-1.7 1L4.5 9.9l-2 3.5 2 1.5a7.8 7.8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-.7a7.6 7.6 0 0 0 1.7 1L9 18h6l.4-2.7a7.6 7.6 0 0 0 1.7-1l2.4.7 2-3.5-2-1.5z" />
    </svg>
  );
}

function IconUser(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M20 21a8 8 0 1 0-16 0" />
      <path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    </svg>
  );
}

export function ThemeProvider({ children, user }: { children: React.ReactNode; user?: UserProfile }) {
  const pathname = usePathname();
  const [theme, setTheme] = React.useState<Theme>("system");

  React.useEffect(() => {
    const saved = (localStorage.getItem("eoynx_theme") as Theme | null) ?? "system";
    setTheme(saved);
    applyTheme(saved);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = (localStorage.getItem("eoynx_theme") as Theme | null) ?? "system";
      if (current === "system") applyTheme("system");
    };

    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const set = (t: Theme) => {
    localStorage.setItem("eoynx_theme", t);
    setTheme(t);
    applyTheme(t);
  };

  // Determine profile link
  const profileHref = user ? `/u/${user.handle}` : "/auth";
  const profileLabel = user ? "Profile" : "Sign in";

  return (
    <div>
      <div className="fixed left-0 right-0 top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            EOYNX
          </Link>

          <div className="flex items-center gap-1 text-sm">
            {(
              [
                { href: "/feed", label: "Feed", Icon: IconHome },
                { href: "/search", label: "Search", Icon: IconSearch },
                { href: "/add", label: "Add", Icon: IconPlus },
                { href: "/dm", label: "DM", Icon: IconDM },
                { href: "/settings", label: "Settings", Icon: IconSettings },
              ] as const
            ).map(({ href, label, Icon }) => {
              const active = pathname === href || pathname?.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  aria-label={label}
                  title={label}
                  className={
                    "inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors " +
                    (active
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white")
                  }
                >
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })}

            {/* Profile link */}
            <Link
              href={profileHref}
              aria-label={profileLabel}
              title={profileLabel}
              className={
                "inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full transition-colors " +
                (pathname?.startsWith("/u/")
                  ? "ring-2 ring-violet-500"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white")
              }
            >
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.handle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <IconUser className="h-4 w-4" />
              )}
            </Link>

            <select
              value={theme}
              onChange={(e) => set(e.target.value as Theme)}
              className="ml-2 rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-800 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
              aria-label="Theme"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </div>

      <div className="pt-16">{children}</div>
    </div>
  );
}
