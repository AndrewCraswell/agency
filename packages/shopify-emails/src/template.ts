import type { ReactElement } from "react"
import { compileToLiquid, type CompileOptions } from "./compile.ts"
import { assertFiltersAreAvailable } from "./filters/validate.ts"
import { asPlainText } from "./liquid/environment.ts"
import { rootRef, type PathRef } from "./refs/path.ts"
import { toLiquidSource } from "./token.ts"
import type { TemplateType, VariablesFor } from "./variables/templates.ts"

/*
 * A template is the variables Shopify renders it with, plus the tree that reads them. Naming the
 * type is the whole contract: it settles what the body may reference and what the preview renders
 * against, so nothing has to be sampled twice.
 *
 * A notification takes its file name from its type, because that is the id Shopify knows it by. A
 * campaign has no such id, so it has to name itself, and it is what a template is unless it says
 * otherwise: everything Shopify names is already accounted for, so anything left is marketing.
 */

export type TemplateDefinition<TVariables extends object> = {
  /** The name of the file Shopify receives, which for a notification is its type. */
  readonly id: string
  readonly type: TemplateType
  readonly subject: (vars: PathRef<TVariables>) => string
  readonly render: (vars: PathRef<TVariables>) => ReactElement
}

type TemplateInput<TType extends TemplateType> = {
  readonly type?: TType
  readonly subject: (vars: PathRef<VariablesFor<TType>>) => string
  readonly render: (vars: PathRef<VariablesFor<TType>>) => ReactElement
} & (TType extends "campaign" ? unknown : { readonly type: TType }) &
  (TType extends "abandonment" | "campaign" ? { readonly id: string } : { readonly id?: never })

export const defineTemplate = <TType extends TemplateType = "campaign">(
  definition: TemplateInput<TType>
): TemplateDefinition<VariablesFor<TType>> => ({
  ...definition,
  id: definition.id ?? definition.type ?? "campaign",
  type: definition.type ?? "campaign"
})

export const compileTemplate = async <TVariables extends object>(
  template: TemplateDefinition<TVariables>,
  options: CompileOptions = {}
): Promise<string> => {
  const liquid = await compileToLiquid(template.render(rootRef<TVariables>()), options)
  assertFiltersAreAvailable(liquid, template.id)
  return liquid
}

export const compileSubject = <TVariables extends object>(template: TemplateDefinition<TVariables>): string => {
  const liquid = asPlainText(() => toLiquidSource(template.subject(rootRef<TVariables>())))
  assertFiltersAreAvailable(liquid, template.id)
  return liquid
}
