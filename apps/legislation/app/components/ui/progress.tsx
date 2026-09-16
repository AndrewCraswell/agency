"use client"

import { Progress as ProgressPrimitive } from "radix-ui"
import * as React from "react"
import { cn } from "@/lib/utils"

function Progress({ className, value, max = 100, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-primary/20", className)}
      value={value}
      max={max}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 bg-primary transition-all motion-reduce:transition-none"
        style={{ transform: `translateX(-${100 - ((value ?? 0) / max) * 100}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
