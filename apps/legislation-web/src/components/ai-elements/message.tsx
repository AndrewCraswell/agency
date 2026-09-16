"use client"

import type { ComponentProps } from "react"
import { Streamdown } from "streamdown"
import { cn } from "@/lib/utils"

type MessageResponseProps = ComponentProps<typeof Streamdown>

export function MessageResponse({ className, ...props }: MessageResponseProps) {
  return <Streamdown className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)} {...props} />
}
