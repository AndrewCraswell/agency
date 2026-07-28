import { randomUUID } from "node:crypto"
import { describe, expect, it } from "vitest"
import {
  BlogAddressInputSchema,
  CompetitorDomainInputSchema,
  CreateBlogRecommendationSchema,
  CreateTenantStoreSchema,
  EnqueueTenantJobSchema,
  isOwnedDomain,
  normalizeOwnedDomains,
  StoreTenantResourceChunkSchema,
  UpsertTenantResourceSchema
} from "./contracts.server"

const digest = "a".repeat(64)

describe("tenant persistence contracts", () => {
  it("normalizes competitor domains and blog addresses", () => {
    expect(CompetitorDomainInputSchema.parse(" HTTPS://WWW.Example.com/products?ref=test ")).toBe("example.com")
    expect(BlogAddressInputSchema.parse("www.example.com/blog/?ref=test#latest")).toEqual({
      hostname: "example.com",
      url: "https://example.com/blog/"
    })
  })

  it.each(["localhost", "127.0.0.1", "ftp://example.com", "https://user@example.com", "example.com:8080"])(
    "rejects unsafe source address %s",
    (address) => {
      expect(() => BlogAddressInputSchema.parse(address)).toThrow("Enter a valid blog address")
    }
  )

  it("recognizes every domain a store owns, however the blog is addressed", () => {
    const owned = normalizeOwnedDomains([" Contosocamp.myshopify.com ", "www.contosocamp.com", "contosocamp.com"])
    expect(owned).toEqual(["contosocamp.com", "contosocamp.myshopify.com"])
    expect(isOwnedDomain("www.contosocamp.com", owned)).toBe(true)
    expect(isOwnedDomain("blog.contosocamp.com", owned)).toBe(true)
    expect(isOwnedDomain("contosocamp.myshopify.com", owned)).toBe(true)
    expect(isOwnedDomain("competitor.com", owned)).toBe(false)
    expect(isOwnedDomain("notcontosocamp.com", owned)).toBe(false)
  })

  it("accepts a canonical Shopify store identity", () => {
    expect(
      CreateTenantStoreSchema.parse({ shopDomain: "contosocamp.myshopify.com", shopName: "Contoso Camp" })
    ).toEqual({ shopDomain: "contosocamp.myshopify.com", shopName: "Contoso Camp" })
  })

  it.each(["ContosoCamp.myshopify.com", "contosocamp.example.com", "https://contosocamp.myshopify.com"])(
    "rejects non-canonical shop domain %s",
    (shopDomain) => {
      expect(() => CreateTenantStoreSchema.parse({ shopDomain, shopName: "Contoso Camp" })).toThrow(/.+/u)
    }
  )

  it("requires a tenant for every job", () => {
    expect(() =>
      EnqueueTenantJobSchema.parse({ jobType: "catalog_sync", idempotencyKey: "catalog:initial", cursor: null })
    ).toThrow(/.+/u)
  })

  // The job type list is declared twice, once as a check constraint on the table and once as this contract. They drifted
  // silently once already: the database accepted a keyword import job that the contract then refused to read back.
  it.each([
    "onboarding",
    "catalog_sync",
    "content_sync",
    "indexing",
    "reconciliation",
    "idea_generation",
    "draft_generation",
    "crosslinks",
    "further_reading",
    "keyword_import"
  ])("accepts the %s job type the database permits", (jobType) => {
    expect(
      EnqueueTenantJobSchema.parse({
        tenantId: randomUUID(),
        jobType,
        idempotencyKey: `${jobType}:initial`,
        cursor: null
      })
    ).toMatchObject({ jobType })
  })

  it("requires normalized tenant resource fields", () => {
    expect(
      UpsertTenantResourceSchema.parse({
        tenantId: randomUUID(),
        shopifyGid: "gid://shopify/Product/1",
        resourceType: "product",
        title: "Beginner fencing jacket",
        handle: "beginner-fencing-jacket",
        canonicalUrl: "https://contosocamp.myshopify.com/products/beginner-fencing-jacket",
        locale: "en-US",
        description: "",
        content: "",
        metadata: {},
        isActive: true,
        isPublished: true,
        isAvailable: true,
        contentHash: digest,
        sourceCreatedAt: null,
        sourceUpdatedAt: null,
        synchronizedAt: new Date()
      })
    ).toMatchObject({ resourceType: "product", contentHash: digest })
  })

  it("rejects incomplete embedding identity", () => {
    expect(() =>
      StoreTenantResourceChunkSchema.parse({
        tenantId: randomUUID(),
        resourceId: randomUUID(),
        ordinal: 0,
        heading: null,
        content: "Choose equipment that meets the required safety rating.",
        sourceHash: digest,
        representationVersion: 1,
        embeddingModel: "text-embedding-3-small",
        embeddingVersion: null
      })
    ).toThrow("Embedding model and version")
  })

  it("requires one tenant across each recommendation relationship", () => {
    expect(() =>
      CreateBlogRecommendationSchema.parse({
        draftId: randomUUID(),
        destinationResourceId: randomUUID(),
        objective: "further_reading",
        sourceRevision: digest,
        sectionLocator: "conclusion",
        anchorText: "choosing your first fencing weapon",
        rationale: "Continues the beginner learning path.",
        evidence: {},
        ranker: "hybrid-v1"
      })
    ).toThrow(/.+/u)
  })
})
