export type ColorTheme = "light" | "dark";

export const THEME_PREFERENCE_KEY = "ravani-theme-preference";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;
type ThemeMedia = Pick<MediaQueryList, "matches">;

export function getStoredTheme(storage: ThemeStorage = window.localStorage): ColorTheme | null {
  try {
    const stored = storage.getItem(THEME_PREFERENCE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

export function getSystemTheme(media?: ThemeMedia): ColorTheme {
  const query = media
    ?? (typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null);
  return query?.matches ? "dark" : "light";
}

export function resolveTheme(storage?: ThemeStorage, media?: ThemeMedia): ColorTheme {
  return getStoredTheme(storage) ?? getSystemTheme(media);
}

export function saveThemePreference(
  theme: ColorTheme,
  storage: ThemeStorage = window.localStorage,
): void {
  try {
    storage.setItem(THEME_PREFERENCE_KEY, theme);
  } catch {
    // The selected theme still applies for this session when storage is unavailable.
  }
}

export function applyTheme(theme: ColorTheme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#0d1224" : "#f5f7fb");
}
