import { isAbsolute } from "node:path"
import { describe, expect, it } from "vitest"
import {
  railwayMaintenanceEnvironment,
  railwayScaleArguments,
  railwayServiceScale,
  stagingSchemaLeaseScriptPath
} from "./platform-hooks.js"

describe("refresh platform hooks", () => {
  it("resolves the schema lease helper independently of the package working directory", () => {
    expect(isAbsolute(stagingSchemaLeaseScriptPath)).toBe(true)
    expect(stagingSchemaLeaseScriptPath.replaceAll("\\", "/")).toMatch(
      /\/scripts\/legislation-staging-schema-lease\.mjs$/
    )
  })

  it("accepts explicit Railway restore topology", () => {
    expect(railwayServiceScale("us-west=2,eu-west=1")).toEqual(["us-west=2", "eu-west=1"])
  })

  it("uses explicit Railway scope for maintenance scaling", () => {
    const arguments_ = railwayScaleArguments("project-id", "environment-id", "service-id", [
      "us-west2=0",
      "europe-west4=2"
    ])

    expect(arguments_).toEqual([
      "scale",
      "-p",
      "project-id",
      "-e",
      "environment-id",
      "-s",
      "service-id",
      "--json",
      "--",
      "us-west2=0",
      "europe-west4=2"
    ])
  })

  it("uses only the workspace API token for maintenance scaling", () => {
    expect(
      railwayMaintenanceEnvironment({
        RAILWAY_API_TOKEN: "workspace-token",
        RAILWAY_TOKEN: "project-token",
        SAFE_VALUE: "preserved"
      })
    ).toEqual({
      RAILWAY_API_TOKEN: "workspace-token",
      SAFE_VALUE: "preserved"
    })
  })

  it.each(["", "us-west=0", "us-west=1,us-west=2", "not a region=1"])(
    "rejects unsafe Railway restore topology %j",
    (value) => {
      expect(() => railwayServiceScale(value)).toThrow("Railway scale")
    }
  )
})
