import { chatIsAvailable } from "../modules/conversations/chatRequest"
import { getResearchSuggestions } from "../modules/conversations/suggestions.server"
import { HomepageLanding } from "../modules/homepage/components/HomepageLanding"

export const dynamic = "force-dynamic"

export default function HomePage() {
  const isAvailable = chatIsAvailable(process.env)
  return <HomepageLanding isAvailable={isAvailable} suggestions={isAvailable ? getResearchSuggestions() : undefined} />
}
