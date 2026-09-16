"use client"

import { useMounted } from "@mantine/hooks"
import { Check, Monitor, Moon, Sun } from "lucide-react"
import { DropdownMenu } from "radix-ui"
import { Button } from "../ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import { parseThemeOverride } from "./theme"
import { useThemePreference } from "./ThemeProvider"

const themeOptions = [
  { value: "light", label: "Light theme", icon: Sun },
  { value: "dark", label: "Dark theme", icon: Moon },
  { value: "system", label: "Use system theme", icon: Monitor }
]

const themeIcons = { light: Sun, dark: Moon, system: Monitor }

export function ThemeToggle() {
  const { preference, setPreference } = useThemePreference()
  const isMounted = useMounted()
  const CurrentIcon = themeIcons[preference]

  function handleValueChange(value: string) {
    if (value === "system") {
      setPreference(value)
      return
    }
    const override = parseThemeOverride(value)
    if (override !== undefined) {
      setPreference(override)
    }
  }

  return (
    <DropdownMenu.Root>
      <Tooltip>
        <DropdownMenu.Trigger asChild>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto text-muted-foreground"
              aria-label="Color theme"
              disabled={!isMounted}
            >
              <CurrentIcon className="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
        </DropdownMenu.Trigger>
        <TooltipContent side="bottom" sideOffset={8}>
          Color theme
        </TooltipContent>
      </Tooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          aria-label="Color theme"
          className="z-50 min-w-44 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          <DropdownMenu.RadioGroup value={preference} onValueChange={handleValueChange}>
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <DropdownMenu.RadioItem
                key={value}
                value={value}
                className="relative flex cursor-pointer items-center gap-2 rounded-sm py-2 pr-8 pl-2 text-sm outline-none focus:bg-accent data-[state=checked]:text-primary"
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
                <DropdownMenu.ItemIndicator className="absolute right-2 flex size-4 items-center justify-center">
                  <Check className="size-4" aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
