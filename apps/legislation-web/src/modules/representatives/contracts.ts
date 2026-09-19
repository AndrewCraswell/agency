import { z } from "zod"

const text = z.string().trim().min(1).max(500)
const publicUrl = z.url({ protocol: /^https?$/ }).nullable()

export const representativeLookupRequestSchema = z.union([
  z.strictObject({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180)
  }),
  z.strictObject({ address: text })
])
export type RepresentativeLookupRequest = z.infer<typeof representativeLookupRequestSchema>

export const representativeProfileSchema = z.strictObject({
  id: text,
  name: text,
  party: text.nullable(),
  imageUrl: publicUrl,
  officialUrl: publicUrl
})
export type RepresentativeProfile = z.infer<typeof representativeProfileSchema>

export const representativeLookupResultSchema = z.strictObject({
  status: z.enum(["matched", "partial", "no_match", "ambiguous", "unsupported"]),
  jurisdictions: z.array(
    z.strictObject({
      code: text,
      id: text.nullable(),
      name: text.nullable(),
      districts: z.array(
        z.strictObject({
          id: text,
          name: text,
          chamber: z.enum(["congress", "upper", "lower", "unicameral"])
        })
      )
    })
  ),
  representatives: z.array(
    z.strictObject({
      name: text,
      party: text.nullable(),
      office: text,
      districtName: text,
      jurisdictionCode: text,
      imageUrl: publicUrl,
      officialUrl: publicUrl,
      matchStatus: z.enum(["matched", "not_found", "ambiguous", "missing_identifier"]),
      profile: representativeProfileSchema.nullable()
    })
  ),
  warnings: z.array(text)
})
export type RepresentativeLookupResult = z.infer<typeof representativeLookupResultSchema>

export const representativeLookupResponseSchema = z.object({ data: representativeLookupResultSchema })
