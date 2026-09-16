import { chatIsAvailable } from "../modules/conversations/chatRequest"
import { ChatWorkspace } from "../modules/conversations/components/ChatWorkspace"

export const dynamic = "force-dynamic"

export default function HomePage() {
  return <ChatWorkspace isAvailable={chatIsAvailable(process.env)} />
}
