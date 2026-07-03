import { Body1, Title1, tokens } from "@fluentui/react-components"

export function AboutPage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalM,
        padding: tokens.spacingVerticalXXL
      }}
    >
      <Title1 as="h1">About</Title1>
      <Body1>A modern Turborepo starter with React 19, Fluent UI v9, and type-safe TanStack Router.</Body1>
    </main>
  )
}
