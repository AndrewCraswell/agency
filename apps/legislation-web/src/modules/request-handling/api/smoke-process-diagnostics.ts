const MAX_DIAGNOSTIC_OUTPUT = 2_000

export interface SmokeProcessOutput {
  secrets: readonly string[]
  stderrTail: string
  stdoutTail: string
}

function safeTail(value: string, secrets: readonly string[]): string {
  let sanitized = value
  for (const secret of secrets) {
    if (secret !== "") {
      sanitized = sanitized.replaceAll(secret, "[redacted]")
    }
  }
  sanitized = sanitized
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [redacted]")
    .replace(/(?:password|secret|token|api[_-]?key|authorization)([\s:=]+)[^\s,;"']+/gi, "$1[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgresql://[redacted]")
  return sanitized.slice(-MAX_DIAGNOSTIC_OUTPUT)
}

export function formatSmokeProcessOutput(output: SmokeProcessOutput): string {
  const stdout = safeTail(output.stdoutTail, output.secrets)
  const stderr = safeTail(output.stderrTail, output.secrets)
  return [stdout === "" ? undefined : `stdout: ${stdout}`, stderr === "" ? undefined : `stderr: ${stderr}`]
    .filter((entry): entry is string => entry !== undefined)
    .join("; ")
}
