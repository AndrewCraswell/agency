import { boundary } from "@shopify/shopify-app-react-router/server"
import { data, redirect, useActionData, useLoaderData } from "react-router"
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router"
import invariant from "tiny-invariant"
import { z } from "zod"
import { toArticleHandle } from "../articles/article-handle"
import { isArticleHtmlEmpty, sanitizeArticleHtml, articleHtmlToText } from "../articles/article-html.server"
import { deleteShopifyArticle, ShopifyArticleWriteError, writeShopifyArticle } from "../articles/shopify-article.server"
import {
  ArticleImageUploadError,
  downloadArticleImage,
  resolveArticleImage,
  uploadArticleImage
} from "../articles/shopify-image.server"
import { ArticleDetailPage } from "../components/ArticleDetailPage"
import {
  ArticleRevisionConflictError,
  ArticleRevisionInUseError,
  createArticleRevision,
  deleteArticle,
  deleteArticleRevision,
  listArticleRevisions,
  recordArticlePublication,
  regenerateArticleFromDraft,
  setArticleDestinationBlog,
  setCurrentArticleRevision
} from "../persistence/article-repository.server"
import {
  attachDraftRecommendations,
  countLinkableDestinations,
  getArticleDetail,
  getArticleIdeaIdentity,
  getArticleWorkflowIdentity,
  getStoreProfile,
  getTenantIdForShop,
  listAuthorSuggestions,
  listDestinationBlogs,
  reviewBlogRecommendation
} from "../persistence/blog-workspace-repository.server"
import { authenticate } from "../shopify.server"
import {
  generateArticleImage,
  generateBlogDraft,
  generateCommercialCrosslinks,
  generateFurtherReading,
  rewriteArticleTitle
} from "../workflows/blog-workflows.server"

const IntentSchema = z.enum([
  "refreshCrosslinks",
  "refreshFurtherReading",
  "regenerateArticle",
  "addSuggestion",
  "removeSuggestion",
  "saveArticle",
  "restoreRevision",
  "deleteRevision",
  "deleteArticle",
  "publishArticle",
  "unpublishArticle",
  "uploadImage",
  "resolveImage",
  "generateImage",
  "rewriteTitle"
])
const IdentifierSchema = z.uuid()
const OptionalIdentifierSchema = z
  .string()
  .nullable()
  .transform((value) => (value === null || value.trim() === "" ? null : value.trim()))
  .refine((value) => value === null || z.uuid().safeParse(value).success, "Expected a revision identifier")
const BlogGidSchema = z.string().trim().startsWith("gid://shopify/Blog/")
const EditorSchema = z.object({
  title: z.string().trim().min(1, "Add a title before saving").max(300),
  excerpt: z.string().max(5000),
  body: z.string().max(400_000),
  tags: z.string().transform((value) =>
    value
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "")
      .slice(0, 20)
  ),
  author: z.string().trim().max(120),
  handle: z.string().max(255).transform(toArticleHandle),
  seoTitle: z.string().trim().max(300),
  seoDescription: z.string().trim().max(500),
  imageUrl: z
    .string()
    .trim()
    .max(2000)
    .transform((value) => (value === "" ? null : value))
    .refine((value) => value === null || z.url().safeParse(value).success, "That image address is not valid"),
  imageAltText: z.string().trim().max(300),
  expectedRevisionId: OptionalIdentifierSchema
})
const RewriteTitleSchema = z.object({
  title: z.string().trim().min(1, "Add a title before asking for a rewrite").max(300),
  instruction: z.string().trim().min(3, "Describe the change you want").max(500)
})
const GenerateImageSchema = z.object({
  title: z.string().trim().min(1, "Add a title before asking for an image").max(300),
  instruction: z.string().trim().min(3, "Describe the image you want").max(500)
})

type Intent = z.infer<typeof IntentSchema>
type ShopifyWriteIntent = Extract<Intent, "publishArticle" | "unpublishArticle">
type Graphql = Parameters<typeof writeShopifyArticle>[0]

const publicationEventTypes = {
  publishArticle: "published",
  unpublishArticle: "unpublished"
} as const

/** How many versions the page carries before a merchant asks for the rest. */
const recentVersionLimit = 5

/**
 * Status for failures caused by an upstream dependency such as Shopify.
 * Gateway codes are avoided because CDNs replace a 502 from the origin with their own HTML error page,
 * which would discard the message this action returns for the merchant.
 */
const upstreamFailureStatus = 424

function failure(intent: string, error: string, status: number) {
  return data({ ok: false, intent, error }, { status })
}

async function requireTenantId(shopDomain: string) {
  const tenantId = await getTenantIdForShop(shopDomain)
  invariant(tenantId !== null, "Store content must be synchronized before an article can be edited")
  return tenantId
}

function readString(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request)
  const articleId = IdentifierSchema.parse(params.articleId)
  const article = await getArticleDetail(session.shop, articleId)
  if (article === null) {
    throw data("Article not found", { status: 404 })
  }
  const tenantId = await requireTenantId(session.shop)
  const showsAllVersions = new URL(request.url).searchParams.get("versions") === "all"
  const [revisionPage, destinationBlogs, store, authorNames, linkableDestinations] = await Promise.all([
    listArticleRevisions(tenantId, articleId, showsAllVersions ? {} : { limit: recentVersionLimit }),
    listDestinationBlogs(session.shop),
    getStoreProfile(session.shop),
    listAuthorSuggestions(session.shop),
    countLinkableDestinations(session.shop)
  ])
  // An article with no author is published under the store's own name, so that name leads the suggestions.
  const authorSuggestions = [...new Set([store.name, ...authorNames])]
  const versions = revisionPage.revisions.map((revision) => ({
    revisionId: revision.revisionId,
    revisionNumber: revision.revisionNumber,
    origin: revision.origin,
    createdAt: revision.createdAt,
    isCurrent: revision.isCurrent,
    isPublished: revision.isPublished,
    hasPublicationHistory: revision.hasPublicationHistory,
    title: revision.title,
    excerpt: articleHtmlToText(revision.excerpt),
    tags: revision.tags,
    bodyText: articleHtmlToText(revision.body),
    author: revision.author,
    handle: revision.handle,
    seoTitle: revision.seoTitle,
    seoDescription: revision.seoDescription
  }))
  const workingCopy = {
    title: article.title,
    excerpt: articleHtmlToText(article.excerpt),
    tags: article.tags,
    bodyText: articleHtmlToText(article.content),
    author: article.author,
    handle: article.handle,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription
  }
  return {
    article,
    versions,
    workingCopy,
    totalVersionCount: revisionPage.totalCount,
    destinationBlogs,
    store,
    authorSuggestions,
    linkableDestinations
  }
}

/** Saves editor content as a new immutable revision so every edit stays recoverable from history. */
async function saveArticle(tenantId: string, articleId: string, formData: FormData) {
  const parsed = EditorSchema.safeParse({
    title: readString(formData, "title"),
    excerpt: readString(formData, "excerpt"),
    body: readString(formData, "body"),
    tags: readString(formData, "tags"),
    author: readString(formData, "author"),
    handle: readString(formData, "handle"),
    seoTitle: readString(formData, "seoTitle"),
    seoDescription: readString(formData, "seoDescription"),
    imageUrl: readString(formData, "imageUrl"),
    imageAltText: readString(formData, "imageAltText"),
    expectedRevisionId: readString(formData, "expectedRevisionId")
  })
  if (!parsed.success) {
    return failure("saveArticle", parsed.error.issues[0]?.message ?? "The article could not be saved", 400)
  }

  const body = sanitizeArticleHtml(parsed.data.body)
  if (isArticleHtmlEmpty(body)) {
    return failure("saveArticle", "Add article content before saving", 400)
  }
  const requestedBlogGid = readString(formData, "destinationBlogGid")
  if (requestedBlogGid !== "") {
    const blogGid = BlogGidSchema.safeParse(requestedBlogGid)
    if (!blogGid.success) {
      return failure("saveArticle", "Choose a blog from the list", 400)
    }
    await setArticleDestinationBlog(tenantId, articleId, blogGid.data)
  }
  const excerpt = sanitizeArticleHtml(parsed.data.excerpt)
  await createArticleRevision(tenantId, articleId, {
    origin: "edited",
    content: {
      title: parsed.data.title,
      excerpt: isArticleHtmlEmpty(excerpt) ? "" : excerpt,
      body,
      tags: parsed.data.tags,
      author: parsed.data.author,
      handle: parsed.data.handle,
      seoTitle: parsed.data.seoTitle,
      seoDescription: parsed.data.seoDescription,
      imageUrl: parsed.data.imageUrl,
      imageAltText: parsed.data.imageAltText
    },
    expectedRevisionId: parsed.data.expectedRevisionId
  })
  return { ok: true, intent: "saveArticle" }
}

/** Sends the current revision to Shopify, then records what was written so the storefront state stays traceable. */
async function writeToShopify(
  graphql: Graphql,
  shopDomain: string,
  tenantId: string,
  articleId: string,
  intent: ShopifyWriteIntent,
  requestedBlogGid: string
) {
  if (requestedBlogGid !== "") {
    const blogGid = BlogGidSchema.safeParse(requestedBlogGid)
    if (!blogGid.success) {
      return failure(intent, "Choose a blog before sending this article to Shopify", 400)
    }
    await setArticleDestinationBlog(tenantId, articleId, blogGid.data)
  }

  const article = await getArticleDetail(shopDomain, articleId)
  if (article === null) {
    return failure(intent, "The article could not be found", 404)
  }
  if (article.currentRevisionId === null) {
    return failure(intent, "Save the article before sending it to Shopify", 400)
  }
  if (article.destinationBlogGid === null) {
    return failure(intent, "Choose a destination blog before sending this article to Shopify", 400)
  }

  const result = await writeShopifyArticle(graphql, {
    shopDomain,
    shopifyArticleGid: article.shopifyArticleGid,
    destinationBlogGid: article.destinationBlogGid,
    title: article.title,
    body: article.content,
    summary: article.excerpt,
    tags: article.tags,
    author: article.author,
    handle: article.handle,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    imageUrl: article.imageUrl,
    imageAltText: article.imageAltText,
    isPublished: intent === "publishArticle"
  })
  await recordArticlePublication(tenantId, articleId, {
    revisionId: article.currentRevisionId,
    eventType: publicationEventTypes[intent],
    shopifyArticleGid: result.shopifyArticleGid,
    shopifyArticleUrl: result.shopifyArticleUrl
  })
  return { ok: true, intent }
}

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request)
  const articleId = IdentifierSchema.parse(params.articleId)
  const formData = await request.formData()
  const intentResult = IntentSchema.safeParse(formData.get("intent"))
  if (!intentResult.success) {
    return failure("unknown", "That action is not supported", 400)
  }

  const intent = intentResult.data
  try {
    if (intent === "refreshCrosslinks" || intent === "refreshFurtherReading") {
      const identity = await getArticleWorkflowIdentity(session.shop, articleId)
      if (intent === "refreshCrosslinks") {
        await generateCommercialCrosslinks(identity.tenantId, identity.draftId)
      } else {
        await generateFurtherReading(identity.tenantId, identity.draftId)
      }
      await attachDraftRecommendations(identity.tenantId, identity.articleId, identity.draftId)
      return { ok: true, intent }
    }

    if (intent === "regenerateArticle") {
      const identity = await getArticleIdeaIdentity(session.shop, articleId)
      const draftId = await generateBlogDraft(identity.tenantId, identity.ideaId)
      await regenerateArticleFromDraft(identity.tenantId, identity.articleId, draftId)
      return { ok: true, intent }
    }
    if (intent === "addSuggestion" || intent === "removeSuggestion") {
      await reviewBlogRecommendation(
        session.shop,
        articleId,
        IdentifierSchema.parse(formData.get("recommendationId")),
        intent === "addSuggestion" ? "accepted" : "rejected"
      )
      return { ok: true, intent }
    }

    if (intent === "uploadImage") {
      const file = formData.get("image")
      if (!(file instanceof File) || file.size === 0) {
        return failure(intent, "Choose an image to upload", 400)
      }
      const image = await uploadArticleImage((query, options) => admin.graphql(query, options), {
        file,
        altText: readString(formData, "imageAltText")
      })
      return { ok: true, intent, imageUrl: image.url }
    }
    if (intent === "resolveImage") {
      const image = await resolveArticleImage(
        (query, options) => admin.graphql(query, options),
        readString(formData, "imageId")
      )
      return { ok: true, intent, imageUrl: image.url, imageAltText: image.altText }
    }
    if (intent === "generateImage") {
      const parsed = GenerateImageSchema.safeParse({
        title: readString(formData, "title"),
        instruction: readString(formData, "instruction")
      })
      if (!parsed.success) {
        return failure(intent, parsed.error.issues[0]?.message ?? "That image could not be requested", 400)
      }
      const identity = await getArticleWorkflowIdentity(session.shop, articleId)
      const drawn = await generateArticleImage(identity.tenantId, parsed.data.title, parsed.data.instruction)
      // The workflow keeps the picture only briefly, so it is copied into Shopify Files before anything points at it.
      const image = await uploadArticleImage((query, options) => admin.graphql(query, options), {
        file: await downloadArticleImage(drawn.imageUrl),
        altText: drawn.altText
      })
      return { ok: true, intent, imageUrl: image.url, imageAltText: drawn.altText }
    }
    if (intent === "rewriteTitle") {
      const parsed = RewriteTitleSchema.safeParse({
        title: readString(formData, "title"),
        instruction: readString(formData, "instruction")
      })
      if (!parsed.success) {
        return failure(intent, parsed.error.issues[0]?.message ?? "That rewrite could not be requested", 400)
      }
      const identity = await getArticleWorkflowIdentity(session.shop, articleId)
      const title = await rewriteArticleTitle(identity.tenantId, parsed.data.title, parsed.data.instruction)
      return { ok: true, intent, title }
    }

    const tenantId = await requireTenantId(session.shop)
    if (intent === "saveArticle") {
      return await saveArticle(tenantId, articleId, formData)
    }
    if (intent === "restoreRevision") {
      await setCurrentArticleRevision(tenantId, articleId, {
        revisionId: IdentifierSchema.parse(formData.get("revisionId")),
        expectedRevisionId: OptionalIdentifierSchema.parse(readString(formData, "expectedRevisionId"))
      })
      return { ok: true, intent }
    }
    if (intent === "deleteRevision") {
      await deleteArticleRevision(tenantId, articleId, IdentifierSchema.parse(formData.get("revisionId")))
      return { ok: true, intent }
    }
    if (intent === "deleteArticle") {
      const article = await getArticleDetail(session.shop, articleId)
      if (article !== null && article.shopifyArticleGid !== null) {
        await deleteShopifyArticle((query, options) => admin.graphql(query, options), article.shopifyArticleGid)
      }
      await deleteArticle(tenantId, articleId)
      return redirect("/app/articles")
    }
    return await writeToShopify(
      (query, options) => admin.graphql(query, options),
      session.shop,
      tenantId,
      articleId,
      intent,
      readString(formData, "destinationBlogGid")
    )
  } catch (error) {
    if (error instanceof ArticleRevisionConflictError) {
      return failure(intent, "This article changed somewhere else. Reload the page, then apply your edit again.", 409)
    }
    if (error instanceof ArticleRevisionInUseError) {
      return failure(intent, error.message, 409)
    }
    if (error instanceof ShopifyArticleWriteError) {
      return failure(intent, error.message, upstreamFailureStatus)
    }
    if (error instanceof ArticleImageUploadError) {
      return failure(intent, error.message, upstreamFailureStatus)
    }
    // Anything left is unexpected, so it reaches the server log rather than disappearing behind the message.
    console.error(`Article action "${intent}" failed`, error)
    return failure(intent, "Something went wrong. Try that again.", 500)
  }
}

export default function ArticleDetail() {
  const {
    article,
    versions,
    workingCopy,
    totalVersionCount,
    destinationBlogs,
    store,
    authorSuggestions,
    linkableDestinations
  } = useLoaderData<typeof loader>()
  const actionResult = useActionData<typeof action>()
  return (
    <ArticleDetailPage
      article={article}
      versions={versions}
      workingCopy={workingCopy}
      totalVersionCount={totalVersionCount}
      destinationBlogs={destinationBlogs}
      store={store}
      authorSuggestions={authorSuggestions}
      linkableDestinations={linkableDestinations}
      actionResult={actionResult ?? null}
      key={article.currentRevisionId ?? article.articleId}
    />
  )
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs)
}
