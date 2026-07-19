import { tokens } from "@fluentui/react-components"
import { Outlet } from "@tanstack/react-router"
import { AppLink } from "@/components/AppLink/AppLink"

/** App layout: top navigation + the active route's content via <Outlet />. */
export function RootLayout() {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <nav
        style={{
          display: "flex",
          gap: tokens.spacingHorizontalL,
          padding: tokens.spacingVerticalM,
          borderBottom: `1px solid ${tokens.colorNeutralStroke2}`
        }}
      >
        <AppLink to="/">Operations</AppLink>
      </nav>
      <Outlet />
    </div>
  )
}
