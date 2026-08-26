import type * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.ComponentProps<"input">

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  )
}
