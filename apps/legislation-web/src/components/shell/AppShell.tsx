import type { ReactNode } from "react"
import { cn } from "../ui/utils"
import { AppHeader } from "./AppHeader"
import * as styles from "./AppShell.css"

export function AppShell({
  children,
  className,
  isResearch = false
}: Readonly<{ children: ReactNode; className?: string; isResearch?: boolean }>) {
  return (
    <div className={cn(styles.shell, className)}>
      <AppHeader isResearch={isResearch} />
      {children}
    </div>
  )
}
