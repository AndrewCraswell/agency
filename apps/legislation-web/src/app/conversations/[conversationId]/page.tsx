import { chatIsAvailable } from "../../../modules/conversations/chatRequest"
import { ChatWorkspace } from "../../../modules/conversations/components/ChatWorkspace"

export const dynamic = "force-dynamic"

type ConversationPageProps = Readonly<{ params: Promise<{ conversationId: string }> }>

export default async function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = await params
  return (
    <ChatWorkspace key={conversationId} conversationId={conversationId} isAvailable={chatIsAvailable(process.env)} />
  )
}
