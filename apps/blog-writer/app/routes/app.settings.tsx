import { boundary } from "@shopify/shopify-app-react-router/server"
import { data, useActionData, useLoaderData } from "react-router"
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router"
import { z } from "zod"
import { BlogDiscoveryError, discoverBlog } from "../blogs/discover.server"
import { SettingsPage } from "../components/SettingsPage"
import { importKeywordEvidence } from "../keywords/import.server"
import { listSupportedKeywordMarkets } from "../keywords/supported-markets.server"
import { BlogAddressInputSchema, CompetitorDomainInputSchema } from "../persistence/contracts.server"
import {
  KeywordMarketUnresolvedError,
  getKeywordImportOverview,
  setKeywordMarket
} from "../persistence/keyword-repository.server"
import { getShopifySyncStatus } from "../persistence/shopify-sync-repository.server"
import {
  BrandBriefSchema,
  OwnDomainSubscriptionError,
  addCompetitorDomain,
  getSourceSettings,
  removeCompetitorDomain,
  setBrandBrief,
  subscribeToBlog,
  unsubscribeFromBlog
} from "../persistence/source-settings-repository.server"
import { detectContentDrift } from "../shopify-sync/fingerprint.server"
import { authenticate } from "../shopify.server"
import { synchronizeStore } from "../workflows/blog-workflows.server"

const IntentSchema = z.enum([
  "sync",
  "setBrandBrief",
  "addCompetitorDomain",
  "removeCompetitorDomain",
  "subscribeToBlog",
  "unsubscribeFromBlog",
  "importKeywords",
  "setKeywordMarket"
])

const StringFormValueSchema = z.string()

/**
 * Reads the markets the provider covers without letting a provider outage take the page down with it.
 *
 * The picker is a convenience over a value the store already has. Losing the ability to change a market is a smaller
 * failure than losing the page that shows it, so an unreachable provider offers no choices rather than an error.
 */
async function readSupportedMarkets() {
  try {
    return await listSupportedKeywordMarkets()
  } catch (error) {
    console.error("Could not read the keyword provider's supported markets.", error)
    return []
  }
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request)
  const [status, sourceSettings, keywordImport, supportedMarkets, contentDrift] = await Promise.all([
    getShopifySyncStatus(session.shop),
    getSourceSettings(session.shop),
    getKeywordImportOverview(session.shop),
    readSupportedMarkets(),
    // Asked on every load rather than remembered, so the page reports the store the merchant has right now instead of
    // the one it copied across the last time somebody pressed the button.
    detectContentDrift(session.shop, (query, options) => admin.graphql(query, options))
  ])

  return {
    ...status,
    ...sourceSettings,
    contentDrift,
    keywordImport,
    supportedMarkets: supportedMarkets.map(({ countryCode, languageCode, locationName }) => ({
      countryCode,
      languageCode,
      locationName
    })),
    lastSynchronizedAt: status.lastSynchronizedAt?.toISOString() ?? null
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const formData = await request.formData()
  const intentResult = IntentSchema.safeParse(formData.get("intent"))
  if (!intentResult.success) {
    return data({ ok: false, intent: "unknown" }, { status: 400 })
  }

  const intent = intentResult.data
  try {
    if (intent === "sync") {
      // Handed to the workflow rather than done here, so the button and the nightly schedule take the same path and
      // one run history covers both. The workflow holds the reply until the sync has finished, so the page still
      // comes back knowing whether it worked.
      await synchronizeStore(session.shop)
    } else if (intent === "setBrandBrief") {
      const value = StringFormValueSchema.parse(formData.get("brandBrief"))
      await setBrandBrief(session.shop, BrandBriefSchema.parse(value))
    } else if (intent === "addCompetitorDomain") {
      const value = StringFormValueSchema.parse(formData.get("competitorDomain"))
      await addCompetitorDomain(session.shop, CompetitorDomainInputSchema.parse(value))
    } else if (intent === "removeCompetitorDomain") {
      const value = StringFormValueSchema.parse(formData.get("competitorDomain"))
      await removeCompetitorDomain(session.shop, CompetitorDomainInputSchema.parse(value))
    } else if (intent === "subscribeToBlog") {
      const value = StringFormValueSchema.parse(formData.get("blogAddress"))
      const discovered = await discoverBlog(BlogAddressInputSchema.parse(value).url)
      await subscribeToBlog(session.shop, discovered.url, discovered.title)
    } else if (intent === "importKeywords") {
      const force = formData.get("force") === "on"
      const result = await importKeywordEvidence(session.shop, { trigger: "manual", force })
      return { ok: true, intent, keywordImportOutcome: result.outcome, keywordImportForced: force }
    } else if (intent === "setKeywordMarket") {
      const countryCode = StringFormValueSchema.parse(formData.get("marketCountryCode"))
      const languageCode = StringFormValueSchema.parse(formData.get("marketLanguageCode"))
      // Matched against the provider's own list rather than parsed, so the only markets that can be stored are ones a
      // collection can actually be run in. A pair arriving from anywhere other than the picker fails here.
      const chosen = (await listSupportedKeywordMarkets()).find(
        (market) => market.countryCode === countryCode && market.languageCode === languageCode
      )
      if (chosen === undefined) {
        return data({ ok: false, intent, error: "unsupportedKeywordMarket" }, { status: 400 })
      }
      await setKeywordMarket(session.shop, chosen)
    } else {
      const value = StringFormValueSchema.parse(formData.get("blogHostname"))
      await unsubscribeFromBlog(session.shop, CompetitorDomainInputSchema.parse(value))
    }
    return { ok: true, intent }
  } catch (error) {
    if (error instanceof KeywordMarketUnresolvedError) {
      return data({ ok: false, intent, error: "keywordMarketUnresolved" }, { status: 400 })
    }
    if (error instanceof OwnDomainSubscriptionError) {
      return data({ ok: false, intent, error: "ownBlogAddress" }, { status: 400 })
    }
    if (error instanceof BlogDiscoveryError) {
      const discoveryErrors = { unreachable: "blogUnreachable", noArticles: "blogHasNoArticles" } as const
      return data({ ok: false, intent, error: discoveryErrors[error.code] }, { status: 400 })
    }
    if (error instanceof z.ZodError) {
      const validationErrors: Partial<Record<typeof intent, string>> = {
        subscribeToBlog: "invalidBlogAddress",
        setBrandBrief: "invalidBrandBrief"
      }
      return data({ ok: false, intent, error: validationErrors[intent] ?? "invalidCompetitorDomain" }, { status: 400 })
    }
    return data({ ok: false, intent }, { status: 500 })
  }
}

export default function Settings() {
  const loaderData = useLoaderData<typeof loader>()
  const actionResult = useActionData<typeof action>()

  return <SettingsPage {...loaderData} actionResult={actionResult ?? null} />
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs)
}
