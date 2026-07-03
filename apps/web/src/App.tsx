import { Button, Spinner, Title1, tokens } from "@fluentui/react-components"
import { SparkleRegular } from "@fluentui/react-icons"
import { Counter, Header } from "@repo/ui"
import { useState } from "react"
import { getWelcomeMessage } from "@/services/api"

export const App = () => {
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const loadMessage = async () => {
    setIsLoading(true)
    try {
      setMessage(await getWelcomeMessage())
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalL,
        alignItems: "center",
        padding: tokens.spacingVerticalXXL
      }}
    >
      <Header title="Web" />
      <Title1>{message || "Welcome to the web app"}</Title1>
      <Counter />
      <Button appearance="primary" icon={<SparkleRegular />} disabled={isLoading} onClick={loadMessage}>
        {isLoading ? <Spinner size="tiny" /> : "Load message"}
      </Button>
    </main>
  )
}
