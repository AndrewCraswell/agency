import type { ReactNode } from "react"
import { cn } from "../../lib/utils"
import { AppHeader } from "./AppHeader"
import * as styles from "./AppShell.css"

export function AppShell({
  children,
  className,
  demo = false
}: Readonly<{ children: ReactNode; className?: string; demo?: boolean }>) {
  return (
    <div className={cn(styles.shell, className)}>
      <AppHeader demo={demo} />
      {children}
    </div>
  )
}
