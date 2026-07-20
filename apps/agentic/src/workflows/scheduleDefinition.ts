import { CronExpressionParser } from "cron-parser"
import { z } from "zod"

export const ScheduleDefinitionShape = {
  intervalSeconds: z.number().int().min(10).max(86_400).nullable(),
  scheduleExpression: z.string().trim().min(1).nullable(),
  timezone: z.string().trim().min(1)
}

export const ScheduleDefinitionSchema = z
  .object(ScheduleDefinitionShape)
  .strict()
  .superRefine((definition, context) => {
    if ((definition.intervalSeconds === null) === (definition.scheduleExpression === null)) {
      context.addIssue({ code: "custom", message: "Choose either an interval or a CRON expression." })
    }
  })

export type ScheduleDefinition = z.infer<typeof ScheduleDefinitionSchema>

export function scheduleDefinitionFromConfig(config: unknown): ScheduleDefinition {
  const parsed = z
    .object({
      intervalSeconds: z.number().int().min(10).max(86_400).optional(),
      cron: z.string().trim().min(1).optional(),
      timezone: z.string().trim().min(1)
    })
    .passthrough()
    .parse(config)
  return ScheduleDefinitionSchema.parse({
    intervalSeconds: parsed.intervalSeconds ?? null,
    scheduleExpression: parsed.cron ?? null,
    timezone: parsed.timezone
  })
}

export function nextScheduleRunAt(definitionValue: ScheduleDefinition, after: Date, hashSeed?: string): Date {
  const definition = ScheduleDefinitionSchema.parse(definitionValue)
  if (definition.intervalSeconds !== null) {
    return new Date(after.getTime() + definition.intervalSeconds * 1_000)
  }
  return CronExpressionParser.parse(definition.scheduleExpression!, {
    currentDate: after,
    tz: definition.timezone,
    hashSeed
  })
    .next()
    .toDate()
}
