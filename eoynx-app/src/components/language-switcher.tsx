'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { setLocale } from '@/app/actions/locale';
import type { Locale } from '@/i18n/request';

export function LanguageSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  const handleChange = (newLocale: Locale) => {
    startTransition(async () => {
      await setLocale(newLocale);
      window.location.reload();
    });
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
      <button
        onClick={() => handleChange('en')}
        disabled={isPending}
        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          locale === 'en'
            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => handleChange('ko')}
        disabled={isPending}
        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          locale === 'ko'
            ? 'bg-zinc-900 text-white dark:bg-white dark:text-black'
            : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
        }`}
      >
        한
      </button>
    </div>
  );
}
