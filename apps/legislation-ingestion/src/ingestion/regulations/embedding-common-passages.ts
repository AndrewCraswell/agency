import { embeddingTokenizer } from "@repo/legislation-core/embeddings/embedding-tokenizer"
import { digest } from "@repo/legislation-core/legal-text/contracts"
import { buildLegalTextProjection, storedLegalSourceBlocks } from "@repo/legislation-core/legal-text/reader-text"
import invariant from "tiny-invariant"
import { z } from "zod"
import { inspectLegalPassagePreparation } from "./passage-inspection.js"
import { buildLegalPassages } from "./passages.js"

const regulatoryCommonPassageInputSchema = z.strictObject({
  versionId: z.string().min(1).max(256),
  body: z.string(),
  blocks: z.unknown(),
  inputContract: z.string().min(1),
  context: z.string().max(16000)
})

/** Offline comparison inputs. A combined counter sets boundaries; real counters supply model-specific usage. */
export async function prepareCommonRegulatoryPassages(inputValue: unknown) {
  const input = regulatoryCommonPassageInputSchema.parse(inputValue)
  const models = await Promise.all(
    (["openai/text-embedding-3-small", "voyageai/voyage-4"] as const).map(async (model) => ({
      model,
      tokenizer: await embeddingTokenizer(model)
    }))
  )
  const qualification = models.map(({ model, tokenizer }) =>
    inspectLegalPassagePreparation({ ...input, model, tokenizer })
  )
  invariant(
    qualification.every((row) => row.status === "prepared" && row.eligibility === "eligible"),
    "regulatory_common_whole_version_ineligible"
  )
  const tokenizer = {
    id: `regulatory-common:${digest(JSON.stringify(models.map(({ model, tokenizer: counter }) => [model, counter.id])))}`,
    count: (text: string) =>
      Math.max(...models.map(({ tokenizer: counter }) => z.int().nonnegative().parse(counter.count(text))))
  }
  const sourceBlocks = storedLegalSourceBlocks(input)
  const projection = buildLegalTextProjection({ ...input, blocks: sourceBlocks })
  const prepared = buildLegalPassages({ projection, sourceBlocks, context: input.context, tokenizer })
  invariant(
    prepared.passages.map((passage) => passage.text).join("") === input.body,
    "regulatory_common_reconstruction"
  )
  const passages = prepared.passages.map((passage) => {
    const modelCounts = models.map(({ model, tokenizer: counter }) => {
      const tokens = z.int().nonnegative().parse(counter.count(passage.inputText))
      invariant(tokens <= 1200, "regulatory_common_token_limit")
      return { model, tokenizerId: counter.id, tokens }
    })
    invariant(
      Math.max(...modelCounts.map((row) => row.tokens)) === passage.tokenCount,
      "regulatory_common_token_recount"
    )
    invariant(digest(passage.inputText) === passage.inputHash, "regulatory_common_input_hash")
    const { tokenCount: maximumTokenCount, ...source } = passage
    return { ...source, maximumTokenCount, modelCounts }
  })
  return {
    versionId: input.versionId,
    bodyHash: digest(input.body),
    sourceBlocksHash: digest(JSON.stringify(sourceBlocks)),
    contextHash: digest(input.context.trim()),
    generation: prepared.generation,
    tokenizerId: tokenizer.id,
    manifestHash: digest(JSON.stringify(passages)),
    qualification,
    passages,
    records: passages.map(({ id, versionId, inputText }) => ({ id, versionId, input: inputText })),
    sourceProvenanceVerified: false,
    modelSelected: false,
    bulkEmbeddingAuthorized: false
  }
}
