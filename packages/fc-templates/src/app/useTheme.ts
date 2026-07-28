import { useState } from "react"

export type Theme = "light" | "dark"

const STORAGE_KEY = "fcPreviewTheme"

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light"
}

/**
 * The inline script in index.html chooses the first theme so there is no flash; this only takes
 * over from there, keeping the attribute and localStorage in step with React state.
 */
export function useTheme(): { theme: Theme; toggle: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme)

  function toggle(): void {
    const next = theme === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    localStorage.setItem(STORAGE_KEY, next)
    setTheme(next)
  }

  return { theme, toggle }
}
