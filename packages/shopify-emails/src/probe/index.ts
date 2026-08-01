/*
 * How the variable types in `../variables` were derived, kept out of the main entry point.
 *
 * Nothing here is needed to write a template. It is the apparatus for asking a live store what it
 * actually hands a notification — a throwaway template that describes its own variables, and the
 * reader that turns the rendered result back into data. A consumer only reaches for it to check a
 * drop this package has not seen, or to re-derive the types after Shopify changes something.
 */

export {
  assetQuestions,
  buildProbe,
  candidateNotificationDrops,
  marketingQuestions,
  notificationQuestions,
  type ProbeQuestions
} from "./build.ts"
export { type CapturedValues, parseProbe, type ProbeReport, summariseProbe } from "./capture.ts"
export { deprecatedNotificationDrops, documentedNotificationDrops } from "../samples/documentedDrops.ts"
export { candidateMarketingDrops } from "../samples/marketingDrops.ts"
export { observedNotificationDrops } from "../samples/observedDrops.ts"
