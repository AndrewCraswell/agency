import { useTheme } from "../useTheme.ts"

export function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button className="theme-toggle" type="button" onClick={toggle} aria-label="Toggle theme">
      {theme === "dark" ? "\u2600\uFE0E Light" : "\u263E Dark"}
    </button>
  )
}
