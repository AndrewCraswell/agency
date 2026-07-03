import { http, HttpResponse } from "msw"
import { env } from "@/services/env"

/** Default MSW handlers used as the baseline in tests. */
export const handlers = [
  http.get(`${env.VITE_API_BASE_URL}/api/welcome`, () => HttpResponse.json({ message: "Welcome to the web app" }))
]
