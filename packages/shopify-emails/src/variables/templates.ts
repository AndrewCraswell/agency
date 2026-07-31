import type { AbandonmentVariables, CampaignVariables } from "./campaign.ts"
import type { NotificationVariables } from "./notifications.ts"

/*
 * Everything a body can be rendered with, keyed by the name a template declares as its `type`. The
 * forty-six ids are Shopify's own; `campaign` and `abandonment` are not, because a marketing send
 * has no template in the admin to take a name from.
 */
export type TemplateVariables = NotificationVariables & {
  readonly abandonment: AbandonmentVariables
  readonly campaign: CampaignVariables
}

export type TemplateType = keyof TemplateVariables

export type VariablesFor<TType extends TemplateType> = TemplateVariables[TType]
