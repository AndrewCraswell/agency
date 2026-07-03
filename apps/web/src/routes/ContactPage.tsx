import { Body1, Button, Field, Input, Title1, tokens } from "@fluentui/react-components"
import { useForm } from "@tanstack/react-form"
import { useState } from "react"
import { z } from "zod"

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email")
})

/** Example form built with TanStack Form, validated by a zod (Standard Schema). */
export function ContactPage() {
  const [submitted, setSubmitted] = useState<string>()

  const form = useForm({
    defaultValues: { name: "", email: "" },
    validators: { onChange: contactSchema },
    onSubmit: ({ value }) => {
      setSubmitted(`Thanks, ${value.name}! We'll reach out at ${value.email}.`)
    }
  })

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalL,
        padding: tokens.spacingVerticalXXL,
        maxWidth: 420
      }}
    >
      <Title1 as="h1">Contact</Title1>
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
        style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}
      >
        <form.Field name="name">
          {(field) => (
            <Field
              label="Name"
              validationState={field.state.meta.errors.length > 0 ? "error" : "none"}
              validationMessage={field.state.meta.errors[0]?.message}
            >
              <Input
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(_event, data) => field.handleChange(data.value)}
              />
            </Field>
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <Field
              label="Email"
              validationState={field.state.meta.errors.length > 0 ? "error" : "none"}
              validationMessage={field.state.meta.errors[0]?.message}
            >
              <Input
                type="email"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(_event, data) => field.handleChange(data.value)}
              />
            </Field>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => state.canSubmit}>
          {(canSubmit) => (
            <Button type="submit" appearance="primary" disabled={!canSubmit}>
              Submit
            </Button>
          )}
        </form.Subscribe>
      </form>

      {submitted ? <Body1>{submitted}</Body1> : null}
    </main>
  )
}
