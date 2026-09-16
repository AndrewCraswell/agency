import { notFound } from "next/navigation"
import { RecordProfile } from "../../../../modules/conversations/components/RecordProfile"

export default async function Page({
  params,
  searchParams
}: Readonly<{
  params: Promise<{ kind: string; recordId: string }>
  searchParams: Promise<{ result?: string; parent?: string }>
}>) {
  const { kind, recordId } = await params
  if (kind !== "person" && kind !== "organization" && kind !== "material") {
    notFound()
  }
  const { result, parent } = await searchParams
  let id: string
  try {
    id = decodeURIComponent(recordId)
  } catch {
    notFound()
  }
  return (
    <RecordProfile
      key={`${kind}:${id}:${result}`}
      kind={kind}
      recordId={id}
      resultId={result}
      parentRecordId={parent}
    />
  )
}
