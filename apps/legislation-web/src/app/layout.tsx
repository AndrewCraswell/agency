import type { Metadata } from "next"
import { Fraunces, IBM_Plex_Mono, Newsreader, Public_Sans } from "next/font/google"
import Script from "next/script"
import type { ReactNode } from "react"
import { BrowserWebVitals } from "../components/telemetry/BrowserWebVitals"
import { themeInitializationScript } from "../components/theme/theme"
import { ChatProviders } from "../modules/conversations/components/ChatProviders"
import "./styles.css"

const publicSans = Public_Sans({ subsets: ["latin"], display: "swap", variable: "--font-public-sans" })
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", variable: "--font-fraunces" })
const newsreader = Newsreader({ subsets: ["latin"], display: "swap", variable: "--font-newsreader" })
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-ibm-plex-mono"
})

export const metadata: Metadata = {
  description: "Legislative research with source evidence.",
  icons: {
    icon: "/logo.png"
  },
  title: "Rostra"
}

type RootLayoutProps = Readonly<{
  children: ReactNode
}>

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${publicSans.variable} ${fraunces.variable} ${newsreader.variable} ${ibmPlexMono.variable}`}
    >
      <head>
        <Script id="rostra-theme" strategy="beforeInteractive">
          {themeInitializationScript}
        </Script>
      </head>
      <body>
        <BrowserWebVitals />
        <ChatProviders>{children}</ChatProviders>
      </body>
    </html>
  )
}
