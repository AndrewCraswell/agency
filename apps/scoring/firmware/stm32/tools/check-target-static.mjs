import { spawnSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const [toolchainRoot, elfPath, mapPath, evidencePath] = process.argv.slice(2)

if (!toolchainRoot || !elfPath || !mapPath || !evidencePath) {
  throw new Error("usage: check-target-static.mjs <toolchain-root> <elf> <map> <evidence>")
}

const sourcePath = new URL("../target/stm32g474_target_adapter.c", import.meta.url)
const source = readFileSync(sourcePath, "utf8")
const ownedTargetSources = [
  source,
  readFileSync(new URL("../target/stm32g474_target_main.c", import.meta.url), "utf8"),
  readFileSync(new URL("../core/stm32_target_startup.c", import.meta.url), "utf8")
].join("\n")
const staticRequirements = [
  "SCORING_STM32_OUTPUT_STATE_SAFE_INACTIVE == 0",
  "uint32_t levels = group->high_pins | ((uint32_t)(group->pins & ~group->high_pins) << 16U);",
  "group->port->BSRR = levels;",
  "group->port->MODER |= output_mode;",
  "return SCORING_STATUS_UNAVAILABLE;"
]

for (const requirement of staticRequirements) {
  if (!source.includes(requirement)) {
    throw new Error(`target safety requirement is missing: ${requirement}`)
  }
}

const latchBeforeMode = source.indexOf("group->port->BSRR = levels;")
const firstOutputMode = source.indexOf("group->port->MODER |= output_mode;")

if (latchBeforeMode === -1 || firstOutputMode === -1 || latchBeforeMode > firstOutputMode) {
  throw new Error("candidate output latch is not driven inactive before output mode")
}

if (
  !/validate_integrity\(void \*context\)[\s\S]*SCB->VTOR != FLASH_BASE[\s\S]*SCORING_STATUS_INTEGRITY_FAILURE[\s\S]*SCORING_STATUS_UNAVAILABLE/.test(
    source
  )
) {
  throw new Error("vector placement must not be treated as image-integrity success")
}

if (/\b(?:malloc|calloc|realloc|free)\s*\(/.test(ownedTargetSources)) {
  throw new Error("owned target sources must not use dynamic allocation")
}

if (/esp(?:32)?/i.test(ownedTargetSources)) {
  throw new Error("owned target sources must not contain an ESP control path")
}

function run(tool, args) {
  const result = spawnSync(resolve(toolchainRoot, "bin", tool), args, { encoding: "utf8" })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    throw new Error(`${tool} failed: ${result.stderr}`)
  }

  return result.stdout.trim()
}

const undefinedSymbols = run("arm-none-eabi-nm.exe", ["--undefined-only", elfPath])

if (undefinedSymbols !== "") {
  throw new Error(`target ELF has undefined symbols: ${undefinedSymbols}`)
}

const size = run("arm-none-eabi-size.exe", ["--format=berkeley", elfPath])
const map = readFileSync(mapPath, "utf8")

if (!map.includes("Memory Configuration") || !map.includes("Reset_Handler")) {
  throw new Error("target linker map is missing memory or reset-handler evidence")
}

writeFileSync(
  evidencePath,
  `${JSON.stringify(
    {
      elf: elfPath,
      map: mapPath,
      staticChecks: "passed",
      size
    },
    null,
    2
  )}\n`
)
