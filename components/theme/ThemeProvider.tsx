"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "applyfy-theme";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function applyDocumentThemeClass(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/** Dark mode is only applied on home (`/`) and dashboard — keeps other routes in light palette. */
export function isDarkAllowedPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return pathname === "/" || pathname === "/dashboard";
}

function syncDocumentToRouteAndTheme(pathname: string | null, theme: Theme) {
  if (!isDarkAllowedPath(pathname)) {
    document.documentElement.classList.remove("dark");
    return;
  }
  applyDocumentThemeClass(theme);
}

function ThemeDocumentSync({
  theme,
  mounted,
}: {
  theme: Theme;
  mounted: boolean;
}) {
  const pathname = usePathname();
  useEffect(() => {
    if (!mounted) return;
    syncDocumentToRouteAndTheme(pathname, theme);
  }, [mounted, pathname, theme]);
  return null;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let initial: Theme = "light";
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored === "dark" || stored === "light") {
        initial = stored;
      }
    } catch {
      /* ignore */
    }
    setThemeState(initial);
    setMounted(true);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    const p =
      typeof window !== "undefined" ? window.location.pathname ?? "" : "";
    syncDocumentToRouteAndTheme(p, t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      const p =
        typeof window !== "undefined" ? window.location.pathname ?? "" : "";
      syncDocumentToRouteAndTheme(p, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      mounted,
    }),
    [theme, setTheme, toggleTheme, mounted],
  );

  return (
    <ThemeContext.Provider value={value}>
      <Suspense fallback={null}>
        <ThemeDocumentSync theme={theme} mounted={mounted} />
      </Suspense>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
