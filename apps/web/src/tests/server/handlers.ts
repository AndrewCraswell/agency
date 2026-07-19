import { http, HttpResponse } from "msw"
import { env } from "@/services/env"

/** Default MSW handlers used as the baseline in tests. */
export const handlers = [
  http.get(`${env.VITE_API_BASE_URL}/api/control-plane`, () =>
    HttpResponse.json({
      schemaVersion: "1",
      fetchedAt: "2026-07-19T05:20:00.000Z",
      agents: [
        {
          id: "scrum-master",
          name: "Scrum master",
          role: "scrum_master",
          description: "Reviews eligible work and assigns it to an engineer."
        },
        {
          id: "engineer",
          name: "Engineer",
          role: "engineer",
          description: "Implements one assigned task at a time."
        }
      ],
      tasks: [],
      runs: []
    })
  )
]
