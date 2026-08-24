/**
 * Clones bounded canonical data without reading accessors. The owning
 * processor boundary remains responsible for validating its schema before
 * calling this private helper and chooses the error label and limits for that
 * boundary.
 */

export type CanonicalDataCloneOptions = Readonly<{
  errorLabel: string
  maxDepth: number
  maxEntries: number
  maxStringLength: number
  symbolKeyError: "range" | "type"
}>

type CloneContext = {
  entries: number
  seen: WeakSet<object>
}

function cloneCanonicalDataValue(
  value: unknown,
  context: CloneContext,
  depth: number,
  options: CanonicalDataCloneOptions
): unknown {
  const pluralLabel = `${options.errorLabel}s`

  if (value === null || typeof value === "boolean") {
    return value
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${pluralLabel} cannot contain non-finite numbers`)
    }
    return value
  }

  if (typeof value === "string") {
    if (value.length > options.maxStringLength) {
      throw new RangeError(`${options.errorLabel} strings cannot exceed ${options.maxStringLength} characters`)
    }
    return value
  }

  if (typeof value !== "object" || value === null) {
    throw new TypeError(`${pluralLabel} must contain only plain data`)
  }

  if (depth === options.maxDepth || context.seen.has(value)) {
    throw new RangeError(`${pluralLabel} exceed the supported depth or contain a cycle`)
  }

  context.seen.add(value)
  try {
    if (Array.isArray(value)) {
      if (value.length > options.maxEntries - context.entries) {
        throw new RangeError(`${pluralLabel} cannot exceed ${options.maxEntries} values`)
      }

      const keys = Reflect.ownKeys(value)
      if (keys.length !== value.length + 1 || !keys.includes("length")) {
        throw new TypeError(`${pluralLabel} arrays must use canonical data indices only`)
      }

      const cloned: unknown[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
          throw new TypeError(`${pluralLabel} arrays must use canonical data indices only`)
        }

        context.entries += 1
        cloned.push(cloneCanonicalDataValue(descriptor.value, context, depth + 1, options))
      }

      return Object.freeze(cloned)
    }

    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError(`${pluralLabel} must contain only plain objects and arrays`)
    }

    const keys = Reflect.ownKeys(value)
    if (
      keys.length > options.maxEntries - context.entries ||
      keys.some(
        (key) =>
          (typeof key !== "string" && options.symbolKeyError === "range") ||
          (typeof key === "string" && (key.length === 0 || key.length > options.maxStringLength))
      )
    ) {
      throw new RangeError(`${pluralLabel} cannot exceed ${options.maxEntries} values`)
    }
    context.entries += keys.length

    const cloned: Record<string, unknown> = {}
    for (const key of keys) {
      if (typeof key !== "string") {
        throw new TypeError(`${pluralLabel} must use string keys`)
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor === undefined || !("value" in descriptor)) {
        throw new TypeError(`${pluralLabel} cannot contain accessors`)
      }
      Object.defineProperty(cloned, key, {
        configurable: true,
        enumerable: descriptor.enumerable,
        value: cloneCanonicalDataValue(descriptor.value, context, depth + 1, options),
        writable: true
      })
    }

    return Object.freeze(cloned)
  } finally {
    context.seen.delete(value)
  }
}

export function cloneCanonicalData<Value>(value: Value, options: CanonicalDataCloneOptions): Value {
  return cloneCanonicalDataValue(value, { entries: 1, seen: new WeakSet() }, 0, options) as Value
}
