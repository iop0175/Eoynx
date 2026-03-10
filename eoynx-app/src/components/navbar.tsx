"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Plus, Bell, User, Menu, X } from "lucide-react";

type NavbarProps = {
  user: {
    handle: string;
    avatar_url: string | null;
  } | null;
  unreadNotifications?: number;
};

export function Navbar({ user, unreadNotifications = 0 }: NavbarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Don't show navbar on auth pages
  if (pathname?.startsWith("/auth")) {
    return null;
  }

  const navItems = [
    { href: "/feed", icon: Home, label: "Feed" },
    { href: "/search", icon: Search, label: "Search" },
    { href: "/add", icon: Plus, label: "Add" },
    { href: "/notifications", icon: Bell, label: "Notifications", badge: unreadNotifications },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-black">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="text-lg font-bold tracking-tight">
          EOYNX
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 sm:flex">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Profile */}
          {user ? (
            <Link
              href={`/u/${user.handle}`}
              className={`ml-2 flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-neutral-200 transition-transform hover:scale-105 dark:bg-neutral-800 ${
                pathname?.startsWith("/u/") ? "ring-2 ring-violet-500" : ""
              }`}
            >
              {user.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt={user.handle}
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-4 w-4 text-neutral-500" />
              )}
            </Link>
          ) : (
            <Link
              href="/auth"
              className="ml-2 rounded-full bg-violet-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="flex items-center justify-center rounded-lg p-2 text-neutral-600 hover:bg-neutral-50 sm:hidden dark:text-neutral-400 dark:hover:bg-neutral-900"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="border-t border-neutral-200 bg-white px-4 pb-4 sm:hidden dark:border-neutral-800 dark:bg-black">
          <div className="grid gap-1 pt-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-medium text-white">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}

            {/* Profile */}
            {user ? (
              <Link
                href={`/u/${user.handle}`}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  pathname?.startsWith("/u/")
                    ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-white"
                }`}
              >
                <div className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                  {user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar_url}
                      alt={user.handle}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-3 w-3 text-neutral-500" />
                  )}
                </div>
                <span>Profile</span>
              </Link>
            ) : (
              <Link
                href="/auth"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 rounded-lg bg-violet-600 py-2.5 text-center text-sm font-medium text-white hover:bg-violet-500"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
