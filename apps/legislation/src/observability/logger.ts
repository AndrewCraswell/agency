const levelPriority = {
  debug: 10,
  error: 40,
  info: 20,
  warn: 30
} satisfies Record<LogLevel, number>

export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogContext = Readonly<Record<string, unknown>>

const sensitiveKey = /token|secret|password|api[-_]?key|authorization|cookie/i

function sanitizeValue(value: unknown, key: string): unknown {
  if (sensitiveKey.test(key)) {
    return "[REDACTED]"
  }
  if (typeof value === "string") {
    return value
      .replaceAll(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
      .replaceAll(/(postgres(?:ql)?:\/\/[^:\s/]+:)[^@\s]+@/gi, "$1[REDACTED]@")
      .slice(0, 4000)
  }
  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeValue(item, key))
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, child]) => [childKey, sanitizeValue(child, childKey)])
    )
  }
  return value
}

export function sanitizeLogContext(context: LogContext): LogContext {
  return Object.fromEntries(Object.entries(context).map(([key, value]) => [key, sanitizeValue(value, key)]))
}

export type Logger = Readonly<{
  debug: (message: string, context?: LogContext) => void
  error: (message: string, context?: LogContext) => void
  info: (message: string, context?: LogContext) => void
  warn: (message: string, context?: LogContext) => void
}>

type LoggerOptions = Readonly<{
  clock?: () => Date
  level: LogLevel
  service: string
  write?: (line: string) => void
}>

export function errorContext(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorMessage: sanitizeValue(error.message, "errorMessage"),
      errorName: error.name
    }
  }

  return { errorType: typeof error }
}

export function createLogger(options: LoggerOptions): Logger {
  const clock = options.clock ?? (() => new Date())
  const write = options.write ?? ((line) => process.stdout.write(`${line}\n`))

  function log(level: LogLevel, message: string, context: LogContext = {}) {
    if (levelPriority[level] < levelPriority[options.level]) {
      return
    }

    write(
      JSON.stringify({
        timestamp: clock().toISOString(),
        level,
        service: options.service,
        message,
        ...sanitizeLogContext(context)
      })
    )
  }

  return {
    debug: (message, context) => log("debug", message, context),
    error: (message, context) => log("error", message, context),
    info: (message, context) => log("info", message, context),
    warn: (message, context) => log("warn", message, context)
  }
}
