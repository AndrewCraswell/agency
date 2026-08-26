import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground",
        destructive: "bg-destructive text-primary-foreground hover:bg-destructive/90 hover:text-primary-foreground",
        outline: "border border-border bg-background text-foreground hover:bg-muted hover:text-foreground",
        ghost: "text-foreground hover:bg-muted hover:text-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted hover:text-secondary-foreground"
      },
      size: {
        default: "h-9 px-4 py-2",
        icon: "size-9",
        "icon-xs": "size-[26px]",
        "icon-sm": "size-[30px]",
        "icon-play": "size-[34px]",
        sm: "h-8 px-3 text-xs"
      }
    },
    defaultVariants: {
      size: "default",
      variant: "default"
    }
  }
)

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({ asChild = false, className, size, variant, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button"
  return <Component className={cn(buttonVariants({ className, size, variant }))} data-slot="button" {...props} />
}
