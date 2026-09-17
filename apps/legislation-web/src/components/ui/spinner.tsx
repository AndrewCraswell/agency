import { Loader2Icon } from "lucide-react"
import type { ComponentProps } from "react"
import { cn } from "./utils"

export function Spinner({ className, ...props }: ComponentProps<"svg">) {
  return (
    <Loader2Icon
      aria-hidden="true"
      className={cn("size-4 shrink-0 animate-spin motion-reduce:animate-none", className)}
      {...props}
    />
  )
}
