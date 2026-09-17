import { z } from "zod"
import { entityKindSchema, entityPageSchema } from "../entityResults"
import { meetingDetailsSchema, profileDetailsSchema, voteDetailsSchema } from "../recordDetails"

export const reviewMeetingIds: readonly string[] = [
  "event:congress:committee-meeting-100052",
  "event:openstates:ak-meeting-34-003163d494518de76653ddf9c42e1d59a80b37de1bfa4b2d60232c5d23bce1ca"
]

export const reviewMaterialIds: readonly string[] = [
  "material:congress:00008593b8c67cc75946c885",
  "material:congress:053894933dcc6c83974c72ff",
  "material:congress:0a45898c8a59835bd918a84e",
  "material:congress:0bdfdd8f9b4c56abd18f1151",
  "material:congress:0da416a75fa96fa5c8995dd4",
  "material:congress:10cb5b1f8282379fc0100e66",
  "material:congress:a82498723ffa1f0caacd9370"
]

export const reviewCaptureSchema = z.object({
  toolName: z.string(),
  input: z.record(z.string(), z.json()),
  output: z.object({ data: z.json(), resultSet: entityPageSchema.optional() })
})
export const reviewDatasetSchema = z
  .object({
    capturedAt: z.iso.datetime(),
    captures: z.array(reviewCaptureSchema),
    details: z.record(z.string(), z.union([voteDetailsSchema, meetingDetailsSchema, profileDetailsSchema])),
    failures: z.array(z.object({ toolName: z.string(), message: z.string() }))
  })
  .superRefine((dataset, context) => {
    const kinds = new Set(
      dataset.captures.flatMap((capture) => capture.output.resultSet?.items.map((record) => record.kind) ?? [])
    )
    for (const kind of entityKindSchema.options) {
      if (!kinds.has(kind)) {
        context.addIssue({ code: "custom", message: `No fetched ${kind} record was captured.` })
      }
    }
  })
export type ReviewDataset = z.infer<typeof reviewDatasetSchema>
export type ReviewCapture = z.infer<typeof reviewCaptureSchema>
