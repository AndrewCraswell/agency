"use client"

import { useReportWebVitals } from "next/web-vitals"
import { reportBrowserWebVital } from "../../services/sentry/browserTelemetry"

export function BrowserWebVitals() {
  useReportWebVitals(reportBrowserWebVital)
  return null
}
