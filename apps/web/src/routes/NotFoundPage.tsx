import { Body1, Link, Title1, makeStyles, tokens } from "@fluentui/react-components"
import { ArrowLeftRegular } from "@fluentui/react-icons"
import { createLink } from "@tanstack/react-router"

const useStyles = makeStyles({
  page: {
    minHeight: "60vh",
    display: "grid",
    placeItems: "center",
    padding: tokens.spacingHorizontalXXL
  },
  content: {
    maxWidth: "480px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: tokens.spacingVerticalM
  },
  action: { display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalXS }
})

const RouterLink = createLink(Link)

export function NotFoundPage() {
  const styles = useStyles()
  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <Title1 as="h1">Page not found</Title1>
        <Body1>{"We couldn't find this page."}</Body1>
        <RouterLink className={styles.action} to="/">
          <ArrowLeftRegular aria-hidden="true" />
          Go to Operations
        </RouterLink>
      </div>
    </main>
  )
}
