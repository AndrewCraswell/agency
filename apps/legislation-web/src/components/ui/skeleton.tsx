import type { HTMLAttributes } from "react"
import { cn } from "./utils"

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("motion-safe:animate-pulse rounded-md bg-primary/10", className)} {...props} />
}
