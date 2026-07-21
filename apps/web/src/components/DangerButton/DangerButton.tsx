import { Button, mergeClasses, type ButtonProps } from "@fluentui/react-components"
import { useDangerButtonStyles } from "./DangerButton.styles"

export type DangerButtonProps = ButtonProps

export function DangerButton({ className, ...props }: DangerButtonProps) {
  const classes = useDangerButtonStyles()
  return <Button {...props} className={mergeClasses(classes.root, className)} />
}
