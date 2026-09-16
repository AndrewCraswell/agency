import { ChatWorkspace } from "./components/chat/ChatWorkspace"
import { chatIsAvailable } from "./lib/chatRequest"

export const dynamic = "force-dynamic"

export default function HomePage() {
  return <ChatWorkspace isAvailable={chatIsAvailable(process.env)} />
}
