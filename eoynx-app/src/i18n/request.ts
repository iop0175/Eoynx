import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export const locales = ['en', 'ko'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

// 메시지 로더
async function loadMessages(locale: Locale) {
  switch (locale) {
    case 'ko':
      return (await import('../../messages/ko.json')).default;
    case 'en':
    default:
      return (await import('../../messages/en.json')).default;
  }
}

export default getRequestConfig(async () => {
  // 1. 쿠키에서 언어 설정 확인
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value as Locale | undefined;
  
  if (cookieLocale && locales.includes(cookieLocale)) {
    return {
      locale: cookieLocale,
      messages: await loadMessages(cookieLocale),
    };
  }

  // 2. Accept-Language 헤더에서 브라우저 언어 감지
  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language') || '';
  
  // 한국어 우선 감지
  const browserLocale: Locale = acceptLanguage.toLowerCase().includes('ko') 
    ? 'ko' 
    : defaultLocale;

  return {
    locale: browserLocale,
    messages: await loadMessages(browserLocale),
  };
});
