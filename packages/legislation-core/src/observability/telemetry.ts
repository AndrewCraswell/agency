export type Telemetry = {
  observe<T>(name: string, metadata: Readonly<Record<string, unknown>>, operation: () => Promise<T>): Promise<T>
  reportFailure?(name: string, metadata: Readonly<Record<string, unknown>>, error: unknown): void
  shutdown(): Promise<void>
}
