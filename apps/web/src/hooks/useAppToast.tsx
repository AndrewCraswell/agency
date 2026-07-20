import { Toast, ToastBody, ToastTitle, useToastController, type ToastIntent } from "@fluentui/react-components"

export const appToasterId = "app-toaster"

interface AppToastOptions {
  body?: string
  id?: string
  intent: ToastIntent
  timeoutMs?: number
  title: string
}

export type AppToastDispatcher = ReturnType<typeof useToastController>["dispatchToast"]

export function showAppToast(
  dispatchToast: AppToastDispatcher,
  { body, id, intent, timeoutMs, title }: AppToastOptions
): void {
  dispatchToast(
    <Toast>
      <ToastTitle>{title}</ToastTitle>
      {body === undefined ? null : <ToastBody>{body}</ToastBody>}
    </Toast>,
    {
      intent,
      toastId: id ?? crypto.randomUUID(),
      timeout: timeoutMs ?? (intent === "error" ? 7000 : 4000)
    }
  )
}

export function useAppToast(): AppToastDispatcher {
  return useToastController(appToasterId).dispatchToast
}
