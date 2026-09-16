export type ThemeOverride = "light" | "dark"
export type ThemePreference = ThemeOverride | "system"

export const themeStorageKey = "rostra.theme"

export function parseThemeOverride(value: unknown): ThemeOverride | undefined {
  if (value === "light" || value === "dark") {
    return value
  }
  return undefined
}

export const themeInitializationScript = `(() => {
  let preference;
  try { preference = localStorage.getItem(${JSON.stringify(themeStorageKey)}); } catch {}
  const isDark = preference === "dark" || (preference !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  const theme = isDark ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();`
