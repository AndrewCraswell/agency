"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Check } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import {
  clarificationResponseSchemaFor,
  type ClarificationRequest,
  type ClarificationResponse
} from "../../lib/clarification"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Checkbox } from "../ui/checkbox"
import { RadioGroup, RadioGroupItem } from "../ui/radio-group"
import * as styles from "./ClarificationQuestion.css"

type ClarificationQuestionProps = Readonly<{
  request: ClarificationRequest
  onAnswer: (response: ClarificationResponse) => Promise<void>
  acceptedResponse?: ClarificationResponse
  hasAuthorHeader?: boolean
}>

const inactiveMessages = {
  answered: "This question has already been answered.",
  skipped: "Skipped",
  expired: "This question has expired.",
  superseded: "This question is no longer active."
}

export function ClarificationQuestion({
  request,
  onAnswer,
  acceptedResponse,
  hasAuthorHeader = false
}: ClarificationQuestionProps) {
  if (acceptedResponse) {
    return <ClarificationSummary request={request} response={acceptedResponse} hasAuthorHeader={hasAuthorHeader} />
  }
  if (request.state !== "pending") {
    return (
      <section className="space-y-2" aria-label="Clarification">
        <h2 className="text-xl font-semibold leading-snug">{request.input.question}</h2>
        <p className="text-sm text-muted-foreground">{inactiveMessages[request.state]}</p>
      </section>
    )
  }
  return <ClarificationForm key={`${request.id}:${request.revision}`} request={request} onAnswer={onAnswer} />
}

function ClarificationForm({ request, onAnswer }: ClarificationQuestionProps) {
  const fieldId = useId()
  const submission = useRef(false)
  const [isSending, setIsSending] = useState(false)
  const [acceptedResponse, setAcceptedResponse] = useState<ClarificationResponse>()
  const form = useForm<ClarificationResponse>({
    resolver: zodResolver(clarificationResponseSchemaFor(request)),
    defaultValues: { requestId: request.id, revision: request.revision, status: "answered", selectedIds: [], text: "" }
  })
  const error =
    form.formState.errors.root?.message ??
    form.getFieldState("selectedIds", form.formState).error?.message ??
    form.getFieldState("text", form.formState).error?.message
  const hasTextInput = request.input.kind === "text" || request.input.allowFreeText
  const selectedIds = useWatch({ control: form.control, name: "selectedIds" })

  async function submitResponse(response: ClarificationResponse) {
    if (submission.current) {
      return
    }
    const parsed = clarificationResponseSchemaFor(request).safeParse(response)
    if (!parsed.success) {
      form.setError("root", { message: parsed.error.issues[0]?.message ?? "Check your answer." })
      return
    }
    submission.current = true
    setIsSending(true)
    form.clearErrors()
    try {
      await onAnswer(parsed.data)
      setAcceptedResponse(parsed.data)
    } catch {
      form.setError("root", { message: "Your answer could not be confirmed. Try again." })
    } finally {
      submission.current = false
      setIsSending(false)
    }
  }

  if (acceptedResponse !== undefined) {
    return <ClarificationSummary request={request} response={acceptedResponse} />
  }

  return (
    <form
      aria-label="Clarification"
      aria-busy={isSending}
      onSubmit={(event) => {
        void form.handleSubmit(submitResponse)(event)
      }}
      className="space-y-3"
    >
      <p className="text-xs font-medium text-subtle">Reply needed</p>
      <fieldset
        disabled={isSending}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        className="min-w-0 space-y-3"
      >
        <legend id={`${fieldId}-question`} className="mb-3 text-xl font-semibold leading-snug">
          {request.input.question}
        </legend>
        {request.input.description && <p className="text-sm text-muted-foreground">{request.input.description}</p>}
        {request.input.kind !== "text" && (
          <p className="text-[13px] text-muted-foreground">
            {request.input.kind === "single"
              ? "Choose one"
              : `Choose between ${request.input.minSelections} and ${request.input.maxSelections} options`}
            {request.input.allowFreeText ? ", or answer in your own words." : "."}
          </p>
        )}
        {request.input.kind !== "text" && (
          <Controller
            control={form.control}
            name="selectedIds"
            render={({ field }) => {
              const input = request.input
              if (input.kind === "text") {
                return <></>
              }
              const options = input.options.map((option, index) => {
                const optionId = `${fieldId}-option-${index}`
                const isSelected = field.value.includes(option.id)
                return (
                  <label
                    key={option.id}
                    htmlFor={optionId}
                    className={cn(styles.option, isSelected && styles.selectedOption)}
                  >
                    {input.kind === "single" ? (
                      <RadioGroupItem
                        id={optionId}
                        value={option.id}
                        ref={index === 0 ? field.ref : undefined}
                        aria-labelledby={`${optionId}-label`}
                        aria-invalid={Boolean(error)}
                        aria-describedby={option.description ? `${optionId}-description` : undefined}
                        className="mt-0.5 border-muted-foreground"
                      />
                    ) : (
                      <Checkbox
                        id={optionId}
                        checked={isSelected}
                        ref={index === 0 ? field.ref : undefined}
                        aria-labelledby={`${optionId}-label`}
                        aria-invalid={Boolean(error)}
                        aria-describedby={option.description ? `${optionId}-description` : undefined}
                        className="mt-0.5 border-muted-foreground"
                        onCheckedChange={(checked) => {
                          if (checked === true) {
                            field.onChange([...field.value, option.id])
                          } else {
                            field.onChange(field.value.filter((selectedId) => selectedId !== option.id))
                          }
                        }}
                        onBlur={field.onBlur}
                      />
                    )}
                    <span className="flex min-w-0 flex-col gap-1 break-words">
                      <span id={`${optionId}-label`} className="text-sm font-medium leading-snug">
                        {option.label}
                      </span>
                      {option.description && (
                        <span id={`${optionId}-description`} className="text-xs leading-normal text-subtle">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </label>
                )
              })
              if (input.kind === "single") {
                return (
                  <RadioGroup
                    value={field.value[0] ?? ""}
                    onValueChange={(value) => field.onChange([value])}
                    onBlur={field.onBlur}
                    aria-labelledby={`${fieldId}-question`}
                    aria-describedby={error ? `${fieldId}-error` : undefined}
                    className="gap-2"
                  >
                    {options}
                  </RadioGroup>
                )
              }
              return <div className="grid gap-2">{options}</div>
            }}
          />
        )}
        {hasTextInput && (
          <div className="space-y-1.5">
            <label htmlFor={`${fieldId}-text`} className="text-[13px] font-semibold">
              Your answer
            </label>
            <input
              type="text"
              id={`${fieldId}-text`}
              {...form.register("text")}
              maxLength={2000}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${fieldId}-error` : undefined}
              placeholder="Add a short answer..."
              className={styles.field}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) {
                  event.preventDefault()
                }
              }}
            />
          </div>
        )}
        {error && (
          <p id={`${fieldId}-error`} role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" className={styles.action}>
            {isSending ? "Submitting" : "Continue"}
          </Button>
          {request.input.allowSkip && (
            <Button
              type="button"
              variant="ghost"
              className={styles.action}
              onClick={() => {
                void submitResponse({ requestId: request.id, revision: request.revision, status: "skipped" })
              }}
            >
              Skip
            </Button>
          )}
          {request.input.kind !== "text" && selectedIds.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              className={styles.action}
              onClick={() => {
                form.setValue("selectedIds", [], { shouldDirty: true })
                form.clearErrors()
              }}
            >
              Clear choice
            </Button>
          )}
        </div>
      </fieldset>
    </form>
  )
}

type ClarificationSummaryProps = Readonly<{
  request: ClarificationRequest
  response: ClarificationResponse
  hasAuthorHeader?: boolean
}>

export function ClarificationReceiptStatus({ response }: Readonly<{ response: ClarificationResponse }>) {
  return (
    <output className={styles.receiptStatus}>
      {response.status === "answered" && <Check className="size-4 text-[var(--state-success)]" aria-hidden="true" />}
      {response.status === "skipped" ? "Skipped" : "Answered"}
    </output>
  )
}

function ClarificationSummary({ request, response, hasAuthorHeader = false }: ClarificationSummaryProps) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  const selectedOptions =
    request.input.kind !== "text" && response.status === "answered"
      ? request.input.options.filter((option) => response.selectedIds.includes(option.id))
      : []
  return (
    <section aria-label="Clarification" className={cn(styles.receipt, hasAuthorHeader && styles.receiptWithinMessage)}>
      {!hasAuthorHeader && <ClarificationReceiptStatus response={response} />}
      <h2 ref={heading} tabIndex={-1} className="text-base font-medium leading-snug outline-none">
        {request.input.question}
      </h2>
      {response.status === "answered" && (
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>Your answer</span>
        </div>
      )}
      {selectedOptions.length > 0 && (
        <ul aria-label="Your answer" className="space-y-1 text-[15px]">
          {selectedOptions.map((option) => (
            <li key={option.id}>
              {option.label}
              {option.description && <span className="text-muted-foreground"> / {option.description}</span>}
            </li>
          ))}
        </ul>
      )}
      {response.status === "answered" && response.text && (
        <p className="whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{response.text}</p>
      )}
    </section>
  )
}
