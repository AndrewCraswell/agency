import type { Meta, StoryObj } from "@storybook/react-vite"
import { createMemoryRouter, RouterProvider } from "react-router"
import { ArticleDetailPage } from "./ArticleDetailPage"
import { ArticlesPage } from "./ArticlesPage"
import { HomeDashboard } from "./HomeDashboard"
import { PlanPage } from "./PlanPage"
import { SettingsPage } from "./SettingsPage"

const ideas = [
  {
    ideaId: "11111111-1111-4111-8111-111111111111",
    title: "How to choose a tent for wet-weather camping",
    angle: "A practical guide for families planning rainy trips.",
    targetKeyword: "wet-weather camping tent",
    rationale: "Connects a common customer concern to the synchronized catalog.",
    status: "selected" as const,
    scheduledFor: null,
    articleId: null
  }
]

const draft = {
  draftId: "22222222-2222-4222-8222-222222222222",
  ideaId: "11111111-1111-4111-8111-111111111111",
  title: "How to choose a tent for wet-weather camping",
  excerpt: "Choose a family tent that keeps rain out while allowing moisture to escape.",
  content:
    "<p>A rainy forecast does not have to cancel a family camping trip.</p><h2>Start with the campsite</h2><p>Choose raised, well-drained ground and keep the entrance away from prevailing weather.</p>",
  status: "review" as const,
  updatedAt: "2026-07-23T12:00:00.000Z"
}

function StoryRouter({ children }: { children: React.ReactNode }) {
  const router = createMemoryRouter([{ path: "/", element: children }])
  return <RouterProvider router={router} />
}

const meta = {
  title: "Blog writer/Pages",
  parameters: { layout: "fullscreen" }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Home: Story = {
  render: () => (
    <StoryRouter>
      <HomeDashboard
        syncStatus="ready"
        activeResourceCount={42}
        lastSynchronizedAt="2026-07-26T09:00:00.000Z"
        subscribedSourceCount={2}
        overview={{
          articles: [
            {
              articleId: "22222222-2222-4222-8222-222222222222",
              title: draft.title,
              status: "needs_review",
              updatedAt: draft.updatedAt,
              hasUnpublishedChanges: false,
              proposedCrosslinkCount: 3,
              proposedFurtherReadingCount: 1,
              staleLinkCount: 0,
              publishedAt: null,
              shopifyArticleUrl: null
            }
          ],
          articleCounts: {
            draft: 1,
            needs_review: 1,
            ready_to_publish: 1,
            published: 6,
            needs_attention: 0,
            failed: 0
          },
          ideasToReview: 4,
          scheduledIdeaCount: 3,
          scheduledIdeas: [{ ideaId: ideas[0]!.ideaId, title: ideas[0]!.title, scheduledFor: "2026-07-29" }],
          unscheduledIdeaCount: 2,
          generatingCount: 1,
          failedJobs: []
        }}
      />
    </StoryRouter>
  )
}

export const Plan: Story = {
  render: () => (
    <StoryRouter>
      <PlanPage ideas={ideas} actionResult={null} />
    </StoryRouter>
  )
}

export const Articles: Story = {
  render: () => (
    <StoryRouter>
      <ArticlesPage
        articles={[
          {
            articleId: "22222222-2222-4222-8222-222222222222",
            title: draft.title,
            excerpt: draft.excerpt,
            status: "needs_review",
            updatedAt: draft.updatedAt,
            linkTypeCounts: { product: 1, collection: 0, blog: 0, article: 0, page: 0 }
          }
        ]}
      />
    </StoryRouter>
  )
}

export const ArticleDetail: Story = {
  render: () => (
    <StoryRouter>
      <ArticleDetailPage
        article={{
          articleId: "22222222-2222-4222-8222-222222222222",
          title: draft.title,
          excerpt: draft.excerpt,
          content: draft.content,
          tags: ["camping", "gear"],
          author: "Dana Reed",
          handle: "choose-a-family-tent",
          seoTitle: "",
          seoDescription: "",
          imageUrl: null,
          imageAltText: "",
          status: "needs_review",
          updatedAt: draft.updatedAt,
          currentRevisionId: "66666666-6666-4666-8666-666666666666",
          publishedRevisionId: null,
          destinationBlogGid: "gid://shopify/Blog/1",
          shopifyArticleGid: null,
          shopifyArticleUrl: null,
          recommendations: [
            {
              recommendationId: "33333333-3333-4333-8333-333333333333",
              objective: "commercial_crosslink",
              sectionLocator: "Start with the campsite",
              anchorText: "family camping tent",
              rationale: "Shows readers a relevant product while they compare shelter and ventilation.",
              status: "proposed",
              destinationTitle: "Trail Family Tent",
              destinationUrl: "https://example.com/products/trail-family-tent",
              destinationType: "product"
            }
          ]
        }}
        versions={[
          {
            revisionId: "66666666-6666-4666-8666-666666666666",
            revisionNumber: 2,
            origin: "edited",
            title: draft.title,
            excerpt: draft.excerpt,
            tags: ["camping", "gear"],
            bodyText: "Pack layers you can add and remove as the day warms up.",
            author: "Dana Reed",
            handle: "choose-a-family-tent",
            seoTitle: "",
            seoDescription: "",
            createdAt: draft.updatedAt,
            isCurrent: true,
            isPublished: false,
            hasPublicationHistory: false
          },
          {
            revisionId: "55555555-5555-4555-8555-555555555555",
            revisionNumber: 1,
            origin: "generated",
            title: draft.title,
            excerpt: draft.excerpt,
            tags: ["camping"],
            bodyText: "Pack layers you can shed as the day warms up.",
            author: "Dana Reed",
            handle: "choose-a-family-tent",
            seoTitle: "",
            seoDescription: "",
            createdAt: draft.updatedAt,
            isCurrent: false,
            isPublished: false,
            hasPublicationHistory: false
          }
        ]}
        workingCopy={{
          title: draft.title,
          excerpt: draft.excerpt,
          tags: ["camping", "gear"],
          bodyText: "Pack layers you can add and remove as the day warms up.",
          author: "Dana Reed",
          handle: "choose-a-family-tent",
          seoTitle: "",
          seoDescription: ""
        }}
        totalVersionCount={2}
        destinationBlogs={[{ blogGid: "gid://shopify/Blog/1", title: "Field notes", handle: "field-notes" }]}
        store={{ name: "Contoso Camp", domain: "contosocamp.myshopify.com" }}
        authorSuggestions={["Contoso Camp", "Dana Reed", "Priya Sharma"]}
        linkableDestinations={{ commercial: 12, reading: 4 }}
        actionResult={null}
      />
    </StoryRouter>
  )
}

export const Settings: Story = {
  render: () => (
    <StoryRouter>
      <SettingsPage
        syncStatus="ready"
        activeResourceCount={42}
        activeResourceCounts={{ product: 24, collection: 8, blog: 2, article: 6, page: 2 }}
        embeddedResourceCount={42}
        contentDrift="current"
        lastSynchronizedAt="2026-07-23T12:00:00.000Z"
        brandBrief="An independent snowboard shop serving riders from their first season to the backcountry."
        competitorDomains={["competitor.example"]}
        supportedMarkets={[
          { countryCode: "CA", languageCode: "en", locationName: "Canada" },
          { countryCode: "CA", languageCode: "fr", locationName: "Canada" },
          { countryCode: "US", languageCode: "en", locationName: "United States" },
          { countryCode: "US", languageCode: "es", locationName: "United States" }
        ]}
        subscribedBlogs={[
          {
            hostname: "publisher.example",
            url: "https://publisher.example/blog",
            title: "Publisher blog",
            lastSynchronizedAt: "2026-07-23T10:00:00.000Z"
          }
        ]}
        keywordImport={{
          market: { countryCode: "US", languageCode: "en", locationName: "United States" },
          competitorDomains: ["competitor.example"],
          lastImport: {
            importId: "8c1a2b3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d",
            status: "succeeded",
            trigger: "manual",
            requestedAt: "2026-07-23T11:00:00.000Z",
            completedAt: "2026-07-23T11:02:00.000Z",
            rowCount: 180,
            cost: "0.045600",
            errorCode: null,
            domains: [
              {
                domain: "contosocamp.example",
                isOwnDomain: true,
                status: "succeeded",
                rowCount: 80,
                availableRowCount: 412,
                domainRank: 91,
                errorCode: null
              },
              {
                domain: "competitor.example",
                isOwnDomain: false,
                status: "succeeded",
                rowCount: 100,
                availableRowCount: 1365,
                domainRank: 218,
                errorCode: null
              }
            ]
          }
        }}
        actionResult={null}
      />
    </StoryRouter>
  )
}
