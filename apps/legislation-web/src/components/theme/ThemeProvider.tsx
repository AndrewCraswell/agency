"use client"

import { useColorScheme, useIsomorphicEffect, useLocalStorage, useMounted } from "@mantine/hooks"
import { createContext, useContext, type ReactNode } from "react"
import invariant from "tiny-invariant"
import { parseThemeOverride, themeStorageKey, type ThemeOverride, type ThemePreference } from "./theme"

type ThemeContextValue = Readonly<{
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}>

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

type ThemeProviderProps = Readonly<{ children: ReactNode }>

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [override, setOverride, clearOverride] = useLocalStorage<ThemeOverride | undefined>({
    key: themeStorageKey,
    deserialize: parseThemeOverride,
    serialize: (value) => value ?? ""
  })
  const systemTheme = useColorScheme("light")
  const isMounted = useMounted()
  const resolvedTheme = override ?? systemTheme

  useIsomorphicEffect(() => {
    if (isMounted) {
      document.documentElement.dataset.theme = resolvedTheme
      document.documentElement.style.colorScheme = resolvedTheme
    }
  }, [isMounted, resolvedTheme])

  function setPreference(preference: ThemePreference) {
    if (preference === "system") {
      clearOverride()
    } else {
      setOverride(preference)
    }
  }

  return <ThemeContext value={{ preference: override ?? "system", setPreference }}>{children}</ThemeContext>
}

export function useThemePreference() {
  const context = useContext(ThemeContext)
  invariant(context, "Theme controls require ThemeProvider")
  return context
}
