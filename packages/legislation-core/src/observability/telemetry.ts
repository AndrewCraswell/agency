export type Telemetry = {
  observe<T>(name: string, metadata: Readonly<Record<string, unknown>>, operation: () => Promise<T>): Promise<T>
  shutdown(): Promise<void>
}
