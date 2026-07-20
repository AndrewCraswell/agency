import { ControlledInput } from "@1js/fluentui-rhf-inputs"
import { Body1, Button, Title1, tokens } from "@fluentui/react-components"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.email("Enter a valid email")
})

type ContactForm = z.infer<typeof contactSchema>

/** Example React Hook Form built with controlled Fluent inputs and zod validation. */
export function ContactPage() {
  const [submitted, setSubmitted] = useState<string>()

  const form = useForm<ContactForm>({
    defaultValues: { name: "", email: "" },
    mode: "onChange",
    resolver: zodResolver(contactSchema)
  })

  const handleSubmit = form.handleSubmit((value) => {
    setSubmitted(`Thanks, ${value.name}! We'll reach out at ${value.email}.`)
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
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM }}
      >
        <ControlledInput control={form.control} name="name" fieldProps={{ label: "Name" }} />
        <ControlledInput control={form.control} name="email" type="email" fieldProps={{ label: "Email" }} />

        <Button type="submit" appearance="primary" disabled={!form.formState.isValid}>
          Submit
        </Button>
      </form>

      {submitted ? <Body1>{submitted}</Body1> : null}
    </main>
  )
}
