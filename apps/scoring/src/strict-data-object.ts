/**
 * Small boundary helper for values that must be ordinary objects containing
 * only enumerable data properties. It deliberately does not clone or invoke
 * accessors: callers decide which fields are allowed and how to interpret the
 * values after this structural check succeeds.
 */

export type StrictDataObject = Record<string, unknown>

export function strictDataObject(
  value: unknown,
  description: string,
  nonStringKeyMessage = `${description} must use string keys`
): StrictDataObject {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    throw new TypeError(`${description} must be a plain object`)
  }

  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      throw new TypeError(nonStringKeyMessage)
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
      throw new TypeError(`${description} properties must be enumerable data values`)
    }
  }

  return value as StrictDataObject
}

export function strictExactDataObject(value: unknown, keys: readonly string[], description: string): StrictDataObject {
  const object = strictDataObject(value, description)
  const actualKeys = Reflect.ownKeys(object)
  if (
    actualKeys.length !== keys.length ||
    actualKeys.some((key) => typeof key !== "string" || !keys.includes(key)) ||
    keys.some((key) => !Object.hasOwn(object, key))
  ) {
    throw new TypeError(`${description} has missing or unrecognized fields`)
  }
  return object
}
