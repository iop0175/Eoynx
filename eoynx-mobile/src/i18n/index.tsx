import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type Language = "en" | "ko";

const STORAGE_KEY = "eoynx.language";

const translations = {
  en: {
    "tab.feed": "Feed",
    "tab.search": "Search",
    "tab.add": "Add",
    "tab.profile": "Profile",
    "tab.settings": "Settings",
    "auth.signInTitle": "Sign in",
    "auth.subtitle": "Google + email/password.",
    "auth.validation": "Email and password are required.",
    "auth.signIn": "Sign In",
    "auth.signUp": "Sign Up",
    "auth.createAccount": "Create Account",
    "auth.continueGoogle": "Continue with Google",
    "auth.connecting": "Connecting...",
    "auth.loading": "Loading...",
    "auth.success": "Check your email for the confirmation link.",
    "feed.title": "Feed",
    "feed.category.all": "For you",
    "feed.category.luxury": "Luxury",
    "feed.category.accessories": "Accessories",
    "feed.category.cars": "Cars",
    "feed.category.realEstate": "Real Estate",
    "settings.title": "Settings",
    "settings.account": "Account",
    "settings.editProfile": "Edit Profile",
    "settings.notifications": "Notifications",
    "settings.privacy": "Privacy",
    "settings.allowDm": "Allow DM from everyone",
    "settings.allowDmHint": "If off, people need request approval.",
    "settings.blockedUsers": "Blocked Users",
    "settings.noBlockedUsers": "No blocked users.",
    "settings.unblock": "Unblock",
    "settings.language": "Language",
    "settings.languageHint": "Apply app language immediately.",
    "settings.korean": "Korean",
    "settings.english": "English",
    "settings.theme": "Theme",
    "settings.themeHint": "Apply light or dark theme.",
    "settings.themeSystem": "System",
    "settings.themeLight": "Light",
    "settings.themeDark": "Dark",
    "settings.open": "Open",
    "settings.signOut": "Sign Out",
    "settings.signOutTitle": "Sign Out",
    "settings.signOutConfirm": "Do you want to sign out now?",
    "common.cancel": "Cancel",
  },
  ko: {
    "tab.feed": "피드",
    "tab.search": "검색",
    "tab.add": "추가",
    "tab.profile": "프로필",
    "tab.settings": "설정",
    "auth.signInTitle": "로그인",
    "auth.subtitle": "구글 + 이메일/비밀번호",
    "auth.validation": "이메일과 비밀번호를 입력해주세요.",
    "auth.signIn": "로그인",
    "auth.signUp": "회원가입",
    "auth.createAccount": "계정 만들기",
    "auth.continueGoogle": "구글로 계속하기",
    "auth.connecting": "연결 중...",
    "auth.loading": "로딩 중...",
    "auth.success": "이메일 인증 링크를 확인해주세요.",
    "feed.title": "피드",
    "feed.category.all": "추천",
    "feed.category.luxury": "럭셔리",
    "feed.category.accessories": "액세서리",
    "feed.category.cars": "자동차",
    "feed.category.realEstate": "부동산",
    "settings.title": "설정",
    "settings.account": "계정",
    "settings.editProfile": "프로필 수정",
    "settings.notifications": "알림",
    "settings.privacy": "개인정보",
    "settings.allowDm": "전체 DM 허용",
    "settings.allowDmHint": "끄면 DM 요청 수락 후 대화 가능합니다.",
    "settings.blockedUsers": "차단한 사용자",
    "settings.noBlockedUsers": "차단한 사용자가 없습니다.",
    "settings.unblock": "차단 해제",
    "settings.language": "언어",
    "settings.languageHint": "앱 언어를 즉시 변경합니다.",
    "settings.korean": "한국어",
    "settings.english": "영어",
    "settings.theme": "테마",
    "settings.themeHint": "라이트/다크 테마를 적용합니다.",
    "settings.themeSystem": "시스템",
    "settings.themeLight": "라이트",
    "settings.themeDark": "다크",
    "settings.open": "열기",
    "settings.signOut": "로그아웃",
    "settings.signOutTitle": "로그아웃",
    "settings.signOutConfirm": "로그아웃 하시겠어요?",
    "common.cancel": "취소",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (!active) return;
      if (stored === "ko" || stored === "en") {
        setLanguageState(stored);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setLanguage = async (next: Language) => {
    setLanguageState(next);
    await AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: TranslationKey) => translations[language][key] ?? translations.en[key],
    }),
    [language]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
