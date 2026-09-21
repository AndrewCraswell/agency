import type { Page } from "playwright"

export type BrowserOperation =
  | { action: "inspect" }
  | { action: "export" }
  | { action: "navigate"; url: string }
  | { action: "submit"; text: string; clarification?: { text: string; optionLabels: string[] } }

export async function scenarioBrowser(
  page: Page,
  operation: BrowserOperation,
  options: {
    signal?: AbortSignal
    origin?: string
    onRecovery?: (observation: { action: string; reason: string; submissionUncertain: boolean }) => Promise<void>
  } = {}
) {
  let dispatchAttempted = false
  const origin =
    options.origin ??
    (await page.evaluate((url) => new URL(url).origin, operation.action === "navigate" ? operation.url : page.url()))
  const actions = {
    async attempt() {
      if (operation.action === "navigate") {
        if ((await page.evaluate((url) => new URL(url).origin, operation.url)) !== origin) {
          throw new Error("Navigation would leave the authorized application origin.")
        }
        const response = await page.goto(operation.url, { waitUntil: "domcontentloaded" })
        if (!response?.ok()) {
          throw new Error(`Application document unavailable: HTTP ${response?.status() ?? "unknown"}`)
        }
        return { navigated: true }
      }
      if ((await page.evaluate(() => location.origin)) !== origin) {
        throw new Error("Browser left the authorized origin; authentication or explicit navigation needs attention.")
      }
      const form = page.getByRole("form", { name: "Clarification", exact: true })
      const isBusy = await page.getByRole("button", { name: "Stop response", exact: true }).isVisible()
      if (operation.action === "submit") {
        if (isBusy) {
          throw new Error("Research is still running; do not submit another question.")
        }
        if (operation.clarification) {
          if (!(await form.isVisible())) {
            throw new Error("Clarification is not visible.")
          }
          const multiple = (await form.getByRole("checkbox").count()) > 0
          for (const label of operation.clarification.optionLabels) {
            const control = form.getByRole(multiple ? "checkbox" : "radio", { name: label, exact: true })
            await control.focus()
            await control.press("Space")
          }
          if (operation.clarification.text) {
            await form.getByRole("textbox", { name: "Your answer", exact: true }).fill(operation.clarification.text)
          }
          await form.getByRole("button", { name: "Continue", exact: true }).focus()
          dispatchAttempted = true
          await form.getByRole("button", { name: "Continue", exact: true }).press("Enter")
        } else {
          await page.getByRole("textbox", { name: "Your question", exact: true }).fill(operation.text)
          await page.getByRole("button", { name: "Send question", exact: true }).focus()
          dispatchAttempted = true
          await page.getByRole("button", { name: "Send question", exact: true }).press("Enter")
        }
        return { submitted: true }
      }
      let snapshot: unknown
      if (operation.action === "export") {
        const code = page.getByLabel("Conversation export JSON", { exact: true }).last()
        const previous = (await code.count()) ? await code.textContent() : null
        await page.getByRole("textbox", { name: "Your question", exact: true }).fill("/export")
        const send = page.getByRole("button", { name: "Send question", exact: true })
        await send.focus()
        await send.press("Enter")
        await page.waitForFunction((old) => {
          const codes = document.querySelectorAll("[data-conversation-export] code")
          return codes.length > 0 && codes[codes.length - 1]?.textContent !== old
        }, previous)
        snapshot = JSON.parse((await code.textContent()) ?? "null")
      }
      const view = await page.evaluate(() => {
        const conversation = document.querySelector('[role="log"][aria-label="Conversation"]')
        const transcript = [
          ...(conversation?.querySelectorAll(
            'article[aria-label="Your question"],article[aria-label="Rostra response"],[role="alert"]'
          ) ?? [])
        ]
          .filter((element) => element instanceof HTMLElement && element.checkVisibility())
          .map((element) => {
            const copy = element.cloneNode(true)
            if (!(copy instanceof HTMLElement)) {
              return ""
            }
            copy
              .querySelectorAll("button,time,[data-conversation-export],script,style")
              .forEach((decoration) => decoration.remove())
            return copy.textContent?.trim() ?? ""
          })
          .join("\n\n")
        const clarificationForm = document.querySelector('form[aria-label="Clarification"]')
        let clarification: { question: string; optionLabels: string[]; multiple: boolean; allowsText: boolean } | null =
          null
        if (clarificationForm instanceof HTMLElement && clarificationForm.checkVisibility()) {
          const multiple = clarificationForm.querySelector('[role="checkbox"],input[type="checkbox"]') !== null
          const options = clarificationForm.querySelectorAll(
            multiple ? '[role="checkbox"],input[type="checkbox"]' : '[role="radio"],input[type="radio"]'
          )
          const optionLabels = [...options].map((element) => {
            const ids = element.getAttribute("aria-labelledby")?.split(/\s+/) ?? []
            return (
              ids
                .map((id) => document.getElementById(id)?.textContent ?? "")
                .join(" ")
                .trim() ||
              element.getAttribute("aria-label") ||
              element.closest("label")?.textContent?.trim() ||
              ""
            )
          })
          clarification = {
            question: clarificationForm.querySelector("legend")?.textContent?.trim() ?? "",
            optionLabels,
            multiple,
            allowsText:
              clarificationForm.querySelector('[aria-label="Your answer"],input:not([type]),textarea') !== null
          }
        }
        const busy =
          [...document.querySelectorAll("button")].some(
            (element) => element.checkVisibility() && element.getAttribute("aria-label") === "Stop response"
          ) ||
          [...document.querySelectorAll("button")].some(
            (element) => element.checkVisibility() && element.textContent?.trim() === "Stop response"
          )
        const hasFailure =
          !!conversation?.querySelector('[role="alert"]') ||
          [...(conversation?.querySelectorAll("button") ?? [])].some(
            (element) =>
              element.checkVisibility() &&
              (element.getAttribute("aria-label") ?? element.textContent)?.trim() === "Try again"
          ) ||
          (conversation
            ?.querySelector('article[aria-label="Rostra response"]:last-of-type')
            ?.textContent?.includes("Incomplete response") ??
            false)
        return {
          url: location.href,
          unavailable: document.body.innerText.includes("This conversation is no longer available"),
          hasComposer:
            document.querySelector(
              '[role="textbox"][aria-label="Your question"],textarea[aria-label="Your question"],[contenteditable="true"][aria-label="Your question"]'
            ) !== null,
          restoring: document.body.innerText.includes("Restoring conversation"),
          busy,
          empty:
            !conversation?.querySelector('article[aria-label="Your question"]') &&
            !document.querySelector("[data-conversation-export]") &&
            !busy,
          visible: { transcript, clarification, hasFailure }
        }
      })
      if (view.unavailable) {
        throw new Error("Conversation access is lost; do not start a replacement silently.")
      }
      if (!view.hasComposer && !view.busy && !view.restoring) {
        throw new Error(
          "Application conversation controls are unavailable; inspect authentication or the application error."
        )
      }
      return { ...view, snapshot }
    }
  }
  while (true) {
    options.signal?.throwIfAborted()
    if (page.isClosed()) {
      throw new Error("Browser page is closed; restore authorized session access before continuing.")
    }
    try {
      return await actions.attempt()
    } catch (error) {
      options.signal?.throwIfAborted()
      const reason =
        error !== null && typeof error === "object" && "message" in error ? String(error.message) : String(error)
      const name = error !== null && typeof error === "object" && "name" in error ? String(error.name) : ""
      const uncertain = operation.action === "submit" && dispatchAttempted
      await options.onRecovery?.({ action: operation.action, reason, submissionUncertain: uncertain })
      if (uncertain) {
        return { submitted: true, delivery: "unknown", reason }
      }
      const transient =
        name === "TimeoutError" ||
        /Execution context was destroyed|Cannot find context|Frame was detached|frame has been detached|interrupted by another navigation|net::ERR_ABORTED/.test(
          reason
        )
      if (!transient || page.isClosed()) {
        throw error
      }
      if ((await page.evaluate(() => location.origin)) !== origin) {
        throw new Error("Browser left the authorized origin; no automatic navigation or submission will follow.")
      }
      const blocked = await page
        .evaluate(
          () =>
            document.body.innerText.includes("This conversation is no longer available") ||
            !!document.querySelector("[data-nextjs-dialog-overlay]")
        )
        .catch(() => false)
      if (blocked) {
        throw new Error("Session access or the application is unavailable; browser retry cannot resolve this blocker.")
      }
      await page.waitForTimeout(250)
    }
  }
}
