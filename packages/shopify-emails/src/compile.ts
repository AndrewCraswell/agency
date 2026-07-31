import type { ReactElement } from "react"
import { render } from "react-email"
import { toLiquidSource } from "./token.ts"

export type CompileOptions = {
  readonly pretty?: boolean
}

/* Renders the component tree, then restores the Liquid that the tokens were protecting. */
export const compileToLiquid = async (email: ReactElement, options: CompileOptions = {}): Promise<string> => {
  const markup = await render(email, { pretty: options.pretty ?? false })
  return toLiquidSource(markup)
}
