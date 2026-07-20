import {
  Button,
  DrawerHeaderTitle,
  Hamburger,
  makeStyles,
  mergeClasses,
  NavDrawer,
  NavDrawerBody,
  NavDrawerHeader,
  NavItem,
  Subtitle1,
  tokens
} from "@fluentui/react-components"
import {
  BoardFilled,
  BoardRegular,
  BranchForkFilled,
  BranchForkRegular,
  bundleIcon,
  DismissRegular,
  PlugConnectedFilled,
  PlugConnectedRegular
} from "@fluentui/react-icons"
import { createLink, Outlet, useRouterState } from "@tanstack/react-router"
import { useState, type ReactNode } from "react"

const useStyles = makeStyles({
  shell: { display: "grid", gridTemplateColumns: "260px minmax(0, 1fr)", minHeight: "100vh" },
  shellCollapsed: { gridTemplateColumns: "48px minmax(0, 1fr)" },
  desktopDrawer: {
    position: "sticky",
    top: 0,
    height: "100vh",
    "@media (max-width: 800px)": { display: "none" }
  },
  collapsedNavigation: {
    position: "sticky",
    top: 0,
    height: "100vh",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    "@media (max-width: 800px)": { display: "none" }
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    paddingBlock: tokens.spacingVerticalS
  },
  mark: {
    width: "28px",
    height: "28px",
    display: "grid",
    placeItems: "center",
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand
  },
  navigationBody: { paddingInline: tokens.spacingHorizontalM },
  content: { minWidth: 0, backgroundColor: tokens.colorNeutralBackground2 },
  mobileHeader: {
    display: "none",
    position: "sticky",
    top: 0,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: "52px",
    paddingInline: tokens.spacingHorizontalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    "@media (max-width: 800px)": { display: "flex" }
  },
  mobileShell: { "@media (max-width: 800px)": { display: "block" } }
})

const OperationsIcon = bundleIcon(BoardFilled, BoardRegular)
const WorkflowsIcon = bundleIcon(BranchForkFilled, BranchForkRegular)
const IntegrationsIcon = bundleIcon(PlugConnectedFilled, PlugConnectedRegular)

const navigation = [
  { to: "/" as const, label: "Operations", icon: <OperationsIcon /> },
  { to: "/workflows" as const, label: "Workflows", icon: <WorkflowsIcon /> },
  { to: "/integrations" as const, label: "Integrations", icon: <IntegrationsIcon /> }
]

const RouterNavItem = createLink(NavItem)

function selectedNavigationValue(pathname: string): string {
  return navigation.find((item) => (item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)))?.to ?? ""
}

function navigationItems(close?: () => void): ReactNode {
  return navigation.map((item) => (
    <RouterNavItem key={item.to} to={item.to} value={item.to} icon={item.icon} onClick={close} preload="intent">
      {item.label}
    </RouterNavItem>
  ))
}

export function RootLayout() {
  const styles = useStyles()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const selectedValue = selectedNavigationValue(pathname)
  const workflowNavigation = pathname.startsWith("/workflows")
  const [navigationOverride, setNavigationOverride] = useState<{
    workflowNavigation: boolean
    open: boolean
  } | null>(null)
  const navigationOpen =
    navigationOverride?.workflowNavigation === workflowNavigation ? navigationOverride.open : !workflowNavigation
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className={mergeClasses(styles.shell, !navigationOpen && styles.shellCollapsed, styles.mobileShell)}>
      {navigationOpen ? (
        <NavDrawer
          className={styles.desktopDrawer}
          type="inline"
          open
          aria-label="Primary navigation"
          selectedValue={selectedValue}
        >
          <NavDrawerHeader>
            <div className={styles.brand}>
              <Hamburger
                aria-label="Collapse navigation"
                onClick={() => setNavigationOverride({ workflowNavigation, open: false })}
              />
              <span className={styles.mark}>A</span>
              <Subtitle1>Agency</Subtitle1>
            </div>
          </NavDrawerHeader>
          <NavDrawerBody className={styles.navigationBody}>{navigationItems()}</NavDrawerBody>
        </NavDrawer>
      ) : (
        <div className={styles.collapsedNavigation}>
          <Hamburger
            aria-label="Expand navigation"
            onClick={() => setNavigationOverride({ workflowNavigation, open: true })}
          />
        </div>
      )}
      <div className={styles.content}>
        <header className={styles.mobileHeader}>
          <Hamburger aria-label="Open navigation" onClick={() => setDrawerOpen(true)} />
          <Subtitle1>Agency</Subtitle1>
          <span style={{ width: 32 }} />
        </header>
        <Outlet />
      </div>
      <NavDrawer
        type="overlay"
        open={drawerOpen}
        position="start"
        aria-label="Primary navigation"
        selectedValue={selectedValue}
        onOpenChange={(_, data) => setDrawerOpen(data.open)}
      >
        <NavDrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                appearance="subtle"
                icon={<DismissRegular />}
                aria-label="Close navigation"
                onClick={() => setDrawerOpen(false)}
              />
            }
          >
            Agency
          </DrawerHeaderTitle>
        </NavDrawerHeader>
        <NavDrawerBody>{navigationItems(() => setDrawerOpen(false))}</NavDrawerBody>
      </NavDrawer>
    </div>
  )
}
