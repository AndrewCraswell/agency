"use client"

import { captureException } from "@sentry/nextjs"
import NextError from "next/error"
import { useEffect } from "react"

type GlobalErrorProps = Readonly<{ error: Error & { digest?: string } }>

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    captureException(error)
  }, [error])
  return (
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
