import { basePreview } from "@repo/storybook-config/preview"
import { definePreview } from "@storybook/nextjs-vite"
import { Fraunces, IBM_Plex_Mono, Newsreader, Public_Sans } from "next/font/google"
import { ChatProviders } from "../src/modules/conversations/components/ChatProviders"
import "../src/app/styles.css"
import "./preview.css"

const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans" })
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" })
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader" })
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-ibm-plex-mono" })

export default definePreview({
  ...basePreview,
  addons: [],
  parameters: {
    ...basePreview.parameters,
    layout: "fullscreen",
    nextjs: { appDirectory: true },
    options: { storySort: { order: ["Review", "Research activity", "Entity cards"] } }
  },
  async beforeAll() {
    const fontClasses = `${publicSans.variable} ${fraunces.variable} ${newsreader.variable} ${mono.variable}`.split(" ")
    document.documentElement.classList.add(...fontClasses)
    const { network } = await import("./mocks")
    network.enable()
    return () => {
      network.disable()
      document.documentElement.classList.remove(...fontClasses)
    }
  },
  decorators: [
    (Story) => (
      <div
        className={`${publicSans.variable} ${fraunces.variable} ${newsreader.variable} ${mono.variable}`}
        style={{ fontFamily: "var(--font-public-sans), sans-serif" }}
      >
        <ChatProviders>
          <Story />
        </ChatProviders>
      </div>
    )
  ]
})
