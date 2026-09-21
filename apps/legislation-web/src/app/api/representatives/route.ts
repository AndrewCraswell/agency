import { createRepresentativeRequestHandler } from "../../../modules/representatives/representativeRequest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const POST = createRepresentativeRequestHandler({
  getLookup: async () => {
    const { getRepresentativeLookup } = await import("../../../modules/representatives/representativeLookup.server")
    return getRepresentativeLookup()
  }
})

export const GET = POST
export const HEAD = POST
export const OPTIONS = POST
export const PUT = POST
export const PATCH = POST
export const DELETE = POST
