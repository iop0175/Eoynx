import { createContext, useContext } from "react";
import type { AppTheme } from "./webUi";

export type ThemePreference = "system" | "light" | "dark";

type ThemeContextValue = {
  themePreference: ThemePreference;
  resolvedTheme: AppTheme;
  setThemePreference: (next: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  value,
  children,
}: {
  value: ThemeContextValue;
  children: React.ReactNode;
}) {
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemePreference must be used within ThemeProvider");
  }
  return context;
}
