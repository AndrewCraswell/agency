import { chatIsAvailable } from "../modules/conversations/chatRequest"
import { ChatWorkspace } from "../modules/conversations/components/ChatWorkspace"
import { getResearchSuggestions } from "../modules/conversations/suggestions.server"

export const dynamic = "force-dynamic"

export default function HomePage() {
  const isAvailable = chatIsAvailable(process.env)
  return <ChatWorkspace isAvailable={isAvailable} suggestions={isAvailable ? getResearchSuggestions() : undefined} />
}
