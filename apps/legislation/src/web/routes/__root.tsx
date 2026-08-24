import { HeadContent, Outlet, Scripts, createRootRoute } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { ErrorBoundary } from "react-error-boundary"
import appCss from "../styles/app.css?url"
import resetCss from "the-new-css-reset/css/reset.css?url"

export const Route = createRootRoute({
  component: RootComponent,
  head: () => ({
    links: [
      { href: resetCss, rel: "stylesheet" },
      { href: appCss, rel: "stylesheet" }
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      {
        content: "Research bills, votes, amendments, meetings, and official legislative documents.",
        name: "description"
      },
      { title: "Legislative Intelligence" }
    ]
  })
})

function RootComponent() {
  return (
    <RootDocument>
      <ErrorBoundary fallback={<RouteError />}>
        <Outlet />
      </ErrorBoundary>
    </RootDocument>
  )
}

function RouteError() {
  return (
    <main className="error-page">
      <p className="eyebrow">Request interrupted</p>
      <h1>This page could not be displayed.</h1>
      <p>Refresh the page to try again. If the problem continues, keep the request ID shown by the API.</p>
    </main>
  )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
