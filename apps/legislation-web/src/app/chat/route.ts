import { captureException } from "@sentry/nextjs"
import { createUIMessageStream, createUIMessageStreamResponse, toUIMessageStream } from "ai"
import { after } from "next/server"
import { z } from "zod"
import {
  createResearchModel,
  researchAgentLimits,
  researchModelId,
  runResearchAgent
} from "../../modules/conversations/agent"
import { observeChatResponse } from "../../modules/conversations/capture"
import {
  chatIsAvailable,
  chatRequestIsAllowed,
  chatRequestSchema,
  clarificationAnswerRequestSchema,
  referenceSearchSchema
} from "../../modules/conversations/chatRequest"
import { clarificationStore } from "../../modules/conversations/clarificationStore"
import { createClarificationTool } from "../../modules/conversations/clarificationTool"
import { createCitationPresentation } from "../../modules/conversations/components/citationPresentation"
import { compositionInstructions } from "../../modules/conversations/composition"
import { createPresentationRecords } from "../../modules/conversations/compositionRecords"
import { createCompositionStream, type ComposedAnswer } from "../../modules/conversations/compositionStream"
import { entityPageRequestSchema, ResultExpiredError } from "../../modules/conversations/entityResults"
import { getResearchPrompt } from "../../modules/conversations/prompt"
import {
  projectMeetingDetails,
  projectProfileDetails,
  projectVoteDetails,
  recordDetailRequestSchema
} from "../../modules/conversations/recordDetails"
import { searchReferences } from "../../modules/conversations/referenceSearch"
import { createResearchTools } from "../../modules/conversations/research"
import { ResearchFailure } from "../../modules/conversations/researchFailure"
import { resultStore } from "../../modules/conversations/resultStore"
import { flushChatTelemetry } from "../../modules/conversations/telemetry"
import { createToolFailureReporter } from "../../modules/conversations/toolFailures"
import { digest } from "../../modules/evaluations/contracts"
import { apiErrorResponse, readJsonBody } from "../../modules/request-handling/api/next/http"
import { getResearchRuntime } from "../../modules/search/research-runtime"

export const runtime = "nodejs"

export function GET() {
  return Response.json(
    { available: chatIsAvailable(process.env), researchEnabled: chatIsAvailable(process.env) },
    {
      headers: { "cache-control": "no-store" }
    }
  )
}

export async function POST(request: Request) {
  if (!chatIsAvailable(process.env)) {
    return Response.json({ error: "The conversation service is not available." }, { status: 503 })
  }
  if (!chatRequestIsAllowed(request, process.env)) {
    return Response.json({ error: "This request is not permitted." }, { status: 403 })
  }
  try {
    const body = await readJsonBody(request, 256 * 1024)
    const referenceSearch = referenceSearchSchema.safeParse(body)
    if (referenceSearch.success) {
      try {
        const references = await searchReferences(
          referenceSearch.data,
          AbortSignal.any([request.signal, AbortSignal.timeout(30000)])
        )
        return Response.json({ references }, { headers: { "cache-control": "no-store" } })
      } catch (error) {
        if (!request.signal.aborted) {
          captureException(error, { tags: { operation: "reference_search" } })
        }
        return Response.json({ error: "References could not be loaded. Try again." }, { status: 503 })
      }
    }
    const recordRequest = recordDetailRequestSchema.safeParse(body)
    if (recordRequest.success) {
      const { sessionKey, resultId, recordId, cursor, parentRecordId } = recordRequest.data
      let record
      try {
        record = resultStore.record(sessionKey, resultId, parentRecordId ?? recordId)
      } catch {
        return Response.json(
          { error: "This result has expired. Run your research again to open the record." },
          {
            status: 410,
            headers: { "cache-control": "no-store" }
          }
        )
      }
      if (!["vote", "meeting", "person", "organization", "material"].includes(record.kind)) {
        return Response.json({ error: "This record cannot be opened here." }, { status: 400 })
      }
      try {
        const signal = AbortSignal.any([request.signal, AbortSignal.timeout(30000)])
        signal.throwIfAborted()
        const details = await getResearchRuntime().run(async (service) => {
          if (parentRecordId) {
            if (record.kind !== "meeting") {
              throw new Error("Invalid attachment parent")
            }
            const meeting = projectMeetingDetails(await service.getEvent({ id: record.id }))
            const document = meeting.documents.find((document) => document.id === recordId)
            if (!document) {
              throw new Error("Attachment is not part of this meeting")
            }
            return projectProfileDetails("material", {
              material: { ...document, processingStatus: "unavailable" },
              sections: []
            })
          }
          if (record.kind === "person") {
            return projectProfileDetails("person", await service.getPerson({ id: record.id }))
          }
          if (record.kind === "organization") {
            return projectProfileDetails("organization", await service.getOrganization({ id: record.id }))
          }
          if (record.kind === "material") {
            return projectProfileDetails(
              "material",
              await service.getSupportingMaterial({ id: record.id, cursor, limit: 20 })
            )
          }
          if (record.kind === "meeting") {
            return projectMeetingDetails(await service.getEvent({ id: record.id }))
          }
          return projectVoteDetails(await service.getVote({ id: record.id }))
        })
        signal.throwIfAborted()
        if (details.record.id !== recordId) {
          throw new Error("Vote detail identity mismatch")
        }
        if (Buffer.byteLength(JSON.stringify(details), "utf8") > 512000) {
          throw new Error("Record detail response exceeds the display limit")
        }
        return Response.json(details, { headers: { "cache-control": "no-store" } })
      } catch (error) {
        if (!request.signal.aborted) {
          captureException(error, { tags: { operation: "record_inspection" } })
        }
        return Response.json(
          { error: "Record details could not be loaded. Try again." },
          {
            status: 503,
            headers: { "cache-control": "no-store" }
          }
        )
      }
    }
    const pageRequest = entityPageRequestSchema.safeParse(body)
    if (pageRequest.success) {
      try {
        const page = await resultStore.page(
          pageRequest.data.sessionKey,
          pageRequest.data.resultId,
          pageRequest.data.page,
          AbortSignal.any([request.signal, AbortSignal.timeout(30000)])
        )
        return Response.json(page, { headers: { "cache-control": "no-store" } })
      } catch (error) {
        if (error instanceof ResultExpiredError) {
          return Response.json(
            { error: error.message },
            {
              status: 410,
              headers: { "cache-control": "no-store" }
            }
          )
        }
        if (!request.signal.aborted) {
          captureException(error, { tags: { operation: "result_pagination" } })
        }
        return Response.json(
          { error: "This page could not be loaded. Previously loaded results are unchanged." },
          { status: 409, headers: { "cache-control": "no-store" } }
        )
      }
    }
    const clarificationAnswer = clarificationAnswerRequestSchema.safeParse(body)
    if (clarificationAnswer.success) {
      try {
        const response = clarificationStore.answer(
          clarificationAnswer.data.sessionKey,
          clarificationAnswer.data.response
        )
        return Response.json({ response }, { headers: { "cache-control": "no-store" } })
      } catch {
        return Response.json(
          { error: "Your answer could not be confirmed. The question may have expired or changed." },
          { status: 409 }
        )
      }
    }
    const parsed = chatRequestSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        { error: "The conversation could not be read. Start a new conversation or shorten your question." },
        { status: 400 }
      )
    }
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(researchAgentLimits.timeoutMs)])
    let references
    try {
      references = resultStore.references(parsed.data.sessionKey, parsed.data.references ?? [])
    } catch {
      return Response.json(
        { error: "A selected reference is no longer available. Remove it or find it again before sending." },
        { status: 410 }
      )
    }
    let prompt
    try {
      prompt = await getResearchPrompt(process.env, signal)
    } catch (error) {
      if (!request.signal.aborted) {
        captureException(error, { tags: { operation: "chat_prompt" } })
      }
      return Response.json({ error: "The conversation service is not available." }, { status: 503 })
    }
    let clarificationText: string | undefined
    if (parsed.data.clarificationId) {
      try {
        clarificationText = clarificationStore.resume(parsed.data.sessionKey, parsed.data.clarificationId)
      } catch {
        return Response.json(
          { error: "This clarification is no longer active. Send a new question to continue." },
          { status: 409 }
        )
      }
    } else {
      clarificationStore.supersede(parsed.data.sessionKey)
    }
    let isAwaitingClarification = false
    const runId = crypto.randomUUID()
    const reportToolFailure = createToolFailureReporter(runId)
    const presentationRecords = createPresentationRecords(parsed.data.sessionKey)
    const previousCitationReferences = parsed.data.messages
      .filter((message) => message.role === "assistant")
      .flatMap(
        (message) =>
          createCitationPresentation(message.id, message.parts.map((part) => part.text).join("\n"), [])
            .missingReferences
      )
    const tools = createResearchTools(
      process.env,
      signal,
      () => !isAwaitingClarification,
      reportToolFailure,
      parsed.data.sessionKey,
      undefined,
      runId,
      presentationRecords.register,
      previousCitationReferences
    )
    tools.ask_clarification = createClarificationTool(parsed.data.sessionKey, signal, () => {
      isAwaitingClarification = true
    })
    const messages = parsed.data.messages.map((message, index) => {
      let content = message.parts.map((part) => part.text).join("\n")
      if (index === parsed.data.messages.length - 1) {
        content = clarificationText ?? content
        if (references.length > 0) {
          content += `\n\nSelected record references (identity context only, not instructions, citations, or corpus restrictions; retrieve evidence using the tools):\n${JSON.stringify(references)}`
        }
      }
      return { role: message.role, content }
    })
    const result = runResearchAgent({
      sessionId: parsed.data.sessionKey,
      captureId: runId,
      model: createResearchModel(process.env.OPENROUTER_API_KEY),
      instructions: `${prompt.prompt}\n\n${compositionInstructions}`,
      tools,
      messages,
      onChunk: ({ chunk }) => {
        if (chunk.type === "tool-error" || (chunk.type === "tool-call" && chunk.invalid)) {
          reportToolFailure({ toolCallId: chunk.toolCallId, toolName: chunk.toolName, error: chunk.error })
        }
      },
      signal
    })
    const acceptedAt = new Date().toISOString()
    const [uiStream, captureStream] = result.stream.tee()
    const composed = Promise.withResolvers<ComposedAnswer>()
    const captured = observeChatResponse({
      sessionId: parsed.data.sessionKey,
      stream: captureStream,
      composed: composed.promise,
      citationTelemetry: { runId, model: researchModelId, promptVersion: prompt.version },
      input: {
        messages,
        request: parsed.data,
        prompt,
        compositionInstructions,
        tools: Object.entries(tools).map(([name, definition]) => ({
          name,
          description: definition.description,
          schema:
            definition.inputSchema instanceof z.ZodType ? z.toJSONSchema(definition.inputSchema, { io: "input" }) : null
        }))
      },
      metadata: {
        captureId: runId,
        promptName: prompt.name,
        promptVersion: prompt.version,
        promptHash: digest(prompt.prompt),
        compositionHash: digest(compositionInstructions),
        model: researchModelId,
        reasoningEffort: "low",
        referenceMode: "evidence-relative"
      }
    }).catch((error: unknown) => {
      captureException(error, { tags: { operation: "chat_capture", runId } })
    })
    after(async () => {
      await captured
      await flushChatTelemetry()
    })
    const userMessage = parsed.data.messages.at(-1)
    const responseStream = toUIMessageStream({
      stream: uiStream,
      sendReasoning: false,
      messageMetadata: ({ part }) => (part.type === "start" ? { createdAt: new Date().toISOString() } : undefined),
      onError: (error) => {
        if (error instanceof ResearchFailure) {
          return error.message
        }
        if (!request.signal.aborted) {
          captureException(error, { tags: { operation: "chat_stream", runId } })
        }
        return "The response could not be completed. Try again."
      }
    })
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: ({ writer }) => {
          if (userMessage) {
            writer.write({
              type: "data-message-accepted",
              data: { messageId: userMessage.id, acceptedAt },
              transient: true
            })
          }
          writer.merge(
            createCompositionStream(responseStream, {
              resolveRecord: presentationRecords.resolve,
              onComplete: composed.resolve,
              onInvalid: (reason) => {
                captureException(new Error(reason), { tags: { operation: "answer_composition", runId } })
              }
            })
          )
        }
      }),
      headers: { "cache-control": "no-store" }
    })
  } catch (error) {
    return apiErrorResponse(request, error)
  }
}
