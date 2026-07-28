/**
 * A Liquid render context. Shopify's drops are open-ended and differ per template, so the shape
 * stays open here rather than pretending we can model all of Shopify's variables.
 */
export type TemplateVariables = Record<string, unknown>

/** One set of variables a template can be rendered with, such as a paid versus unpaid invoice. */
export type TemplateVariation = {
  /** URL-safe; combined with the template id to address a rendered preview. */
  id: string
  name: string
  variables: TemplateVariables
}

export type TemplateGroup = "Printouts" | "Marketing emails" | "Customer notifications"

type TemplateBase = {
  /** Shopify's own identifier where one exists, otherwise our folder slug. */
  id: string
  name: string
  group: TemplateGroup
  /** Folder inside the group's directory, which is also the base name of the Liquid file in it. */
  dir: string
  variations: [TemplateVariation, ...TemplateVariation[]]
}

/** A document the merchant prints. Rendered onto a paper sheet. */
export type PrintoutTemplate = TemplateBase & {
  type: "printout"
}

/** An email Shopify sends. Rendered inside an email client shell with its subject and headers. */
export type EmailTemplate = TemplateBase & {
  type: "email"
  /** Liquid, rendered against the same variables as the body. */
  subject: string
}

export type Template = PrintoutTemplate | EmailTemplate
