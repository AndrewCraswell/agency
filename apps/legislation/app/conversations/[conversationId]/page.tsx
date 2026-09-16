import { ChatWorkspace } from "../../components/chat/ChatWorkspace"
import { chatIsAvailable } from "../../lib/chatRequest"

export const dynamic = "force-dynamic"

type ConversationPageProps = Readonly<{ params: Promise<{ conversationId: string }> }>

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params
  return (
    <ChatWorkspace key={conversationId} conversationId={conversationId} isAvailable={chatIsAvailable(process.env)} />
  )
}
