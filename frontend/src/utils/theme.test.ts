import { afterEach, describe, expect, it } from "vitest";
import {
  applyTheme,
  getStoredTheme,
  resolveTheme,
  saveThemePreference,
  THEME_PREFERENCE_KEY,
} from "./theme";

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.removeProperty("color-scheme");
});

describe("device-aware theme", () => {
  it("uses the system theme until a manual preference exists", () => {
    localStorage.setItem("theme", "light");

    expect(resolveTheme(localStorage, { matches: true })).toBe("dark");
    expect(getStoredTheme(localStorage)).toBeNull();
  });

  it("persists and applies an explicit user theme", () => {
    saveThemePreference("light", localStorage);

    expect(localStorage.getItem(THEME_PREFERENCE_KEY)).toBe("light");
    expect(resolveTheme(localStorage, { matches: true })).toBe("light");

    applyTheme("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});
