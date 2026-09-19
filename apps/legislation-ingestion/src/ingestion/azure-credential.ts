import type { DefaultAzureCredential } from "@azure/identity"

export function createLazyAzureCredential(): Pick<DefaultAzureCredential, "getToken"> {
  let credential: Promise<DefaultAzureCredential> | undefined
  return {
    async getToken(...arguments_: Parameters<DefaultAzureCredential["getToken"]>) {
      credential ??= import("@azure/identity").then(({ DefaultAzureCredential }) => new DefaultAzureCredential())
      return (await credential).getToken(...arguments_)
    }
  }
}
