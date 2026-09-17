"use client"

import type { ComponentProps } from "react"
import { Streamdown } from "streamdown"
import { cn } from "@/components/ui/utils"

type MessageResponseProps = ComponentProps<typeof Streamdown>

export function MessageResponse({ className, tableMaxHeight = 700, ...props }: MessageResponseProps) {
  return (
    <Streamdown
      className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
      tableMaxHeight={tableMaxHeight}
      {...props}
    />
  )
}
