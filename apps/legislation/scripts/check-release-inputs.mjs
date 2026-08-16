const environment = process.env.LEGISLATION_RELEASE_ENVIRONMENT
const applicationImage = process.env.LEGISLATION_RELEASE_IMAGE
const n8nImage = process.env.LEGISLATION_RELEASE_N8N_IMAGE
const workosValues = [process.env.WORKOS_ISSUER, process.env.WORKOS_AUDIENCE, process.env.WORKOS_JWKS_URL]

if (!new Set(["development", "staging", "production"]).has(environment)) {
  throw new Error("LEGISLATION_RELEASE_ENVIRONMENT must be development, staging, or production")
}
for (const [name, value] of [
  ["LEGISLATION_RELEASE_IMAGE", applicationImage],
  ["LEGISLATION_RELEASE_N8N_IMAGE", n8nImage]
]) {
  if (value === undefined || !/@sha256:[a-f0-9]{64}$/.test(value) || /sha256:0{64}$/.test(value)) {
    throw new Error(`${name} must contain a non-placeholder immutable SHA-256 digest`)
  }
}
for (const [index, value] of workosValues.entries()) {
  if (value === undefined || !value.startsWith("https://") || value.includes("replace.invalid")) {
    throw new Error(`WorkOS release value ${index + 1} must be a configured HTTPS URL`)
  }
}

process.stdout.write(`${JSON.stringify({ environment, status: "release-inputs-valid" })}\n`)
