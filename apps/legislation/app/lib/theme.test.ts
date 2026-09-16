import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"
import { parseThemeOverride, themeInitializationScript, themeStorageKey } from "./theme"

describe("theme preference", () => {
  it.each(["light", "dark"])("accepts the %s override", (value) => {
    expect(parseThemeOverride(value)).toBe(value)
  })

  it.each([undefined, null, "system", "", "DARK", '{"theme":"dark"}', 1])(
    "ignores invalid stored preference %s",
    (value) => {
      expect(parseThemeOverride(value)).toBeUndefined()
    }
  )

  it.each([
    { stored: null, isSystemDark: false, expected: "light" },
    { stored: null, isSystemDark: true, expected: "dark" },
    { stored: "light", isSystemDark: true, expected: "light" },
    { stored: "dark", isSystemDark: false, expected: "dark" },
    { stored: "invalid", isSystemDark: true, expected: "dark" }
  ])(
    "initializes $expected before hydration for $stored with system dark=$isSystemDark",
    ({ stored, isSystemDark, expected }) => {
      const root = { dataset: { theme: "" }, style: { colorScheme: "" } }
      const getItem = vi.fn<(key: string) => string | null>(() => stored)
      const setItem = vi.fn<(key: string, value: string) => void>()
      runInNewContext(themeInitializationScript, {
        document: { documentElement: root },
        localStorage: { getItem, setItem },
        matchMedia: () => ({ matches: isSystemDark })
      })
      expect(root.dataset.theme).toBe(expected)
      expect(root.style.colorScheme).toBe(expected)
      expect(getItem).toHaveBeenCalledWith(themeStorageKey)
      expect(setItem).not.toHaveBeenCalled()
    }
  )

  it("uses the system preference when storage is blocked", () => {
    const root = { dataset: { theme: "" }, style: { colorScheme: "" } }
    runInNewContext(themeInitializationScript, {
      document: { documentElement: root },
      get localStorage() {
        throw new Error("Storage is blocked")
      },
      matchMedia: () => ({ matches: true })
    })
    expect(root.dataset.theme).toBe("dark")
    expect(root.style.colorScheme).toBe("dark")
  })
})
