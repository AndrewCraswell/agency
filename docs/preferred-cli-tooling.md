# Preferred CLI Tooling

Use these command-line tools for local development and AI-assisted engineering. Install machine-level tools once, but
keep project-specific CLIs in `devDependencies` so local development, agents, and CI use the same locked version.

## Machine-level tools

### Git

**Use cases:** source control, branches, diffs, commits, repository status, and collaboration through Git remotes.

```powershell
winget install --id Git.Git --exact
git --version
```

Git for Windows includes Git Credential Manager. Configure identity explicitly in each repository when accounts differ:

```powershell
git config user.name "Your Name"
git config user.email "you@example.com"
```

### GitHub CLI

**Use cases:** pull requests, issues, Actions runs, releases, repository settings, and GitHub secrets that Git cannot
manage directly.

```powershell
winget install --id GitHub.cli --exact
gh auth login
gh auth status
```

Authorize the account and scopes required by the target repository. Prefer `gh` over custom REST calls for routine
GitHub operations.

### Node.js, Corepack, and pnpm

**Use cases:** JavaScript and TypeScript execution, dependency installation, project scripts, builds, tests, and
project-local CLIs. This repository requires Node.js 24 or later and pnpm 11.

```powershell
winget install --id OpenJS.NodeJS --exact
corepack enable
corepack prepare pnpm@11.9.0 --activate
node --version
pnpm --version
```

After cloning, run `pnpm install`. Invoke local tools through package scripts or `pnpm exec <tool>`. Use `npm` only when
a tool specifically documents a global npm installation.

### GitHub Copilot CLI

**Use cases:** AI-assisted repository exploration and implementation from a terminal, especially outside VS Code or in
shell-centered workflows.

```powershell
winget install GitHub.Copilot
copilot --version
copilot
```

Run `/login` when prompted. Copilot CLI complements VS Code Chat; it does not automatically inherit workspace MCP
servers, skills, or VS Code-specific tools.

### PowerShell

**Use cases:** the preferred Windows shell, environment configuration, process management, and automation around other
CLIs. PowerShell 7 or later is also required by Copilot CLI on Windows.

```powershell
winget install --id Microsoft.PowerShell --exact
pwsh --version
```

Use Bash only when a project script requires a Unix shell. Hosted Copilot Coding Agent environments provide Bash and
standard Unix utilities.

## Platform tools

### Shopify CLI

**Use cases:** Shopify app and theme development, store authentication, app configuration, code generation, local
previews, deployment, and Admin GraphQL execution.

```powershell
npm install --global @shopify/cli@latest
shopify version
shopify auth login
```

Common commands:

```powershell
shopify app dev
shopify app deploy
shopify app info
shopify store execute --path query.graphql --variables variables.json
```

In the fencing-club workspace, `shopify store execute` can emit a valid response and then fail to exit. Give it at most
15 seconds, terminate it if it remains running, and retain the flushed JSON output.

### Trigger.dev CLI

**Use cases:** developing, testing, and deploying durable background tasks, schedules, retries, and long-running
workflows.

Install it in the application and keep its version aligned with `@trigger.dev/sdk`:

```powershell
pnpm add --save-dev trigger.dev
pnpm add @trigger.dev/sdk
pnpm exec trigger login
pnpm exec trigger --version
```

Typical commands:

```powershell
pnpm exec trigger dev
pnpm exec trigger deploy
pnpm exec trigger deploy --env prod --dry-run
```

Local task execution normally uses `TRIGGER_SECRET_KEY`. Automated deployment uses `TRIGGER_ACCESS_TOKEN`. Keep both in
the approved local or CI secret store.

### Convex CLI

**Use cases:** creating and connecting a Convex backend, synchronizing functions and schema during development,
inspecting data and logs, managing environment variables, generating API types, preview deployments, production
deployment, and optional AI access through MCP.

Install Convex in the application rather than globally:

```powershell
pnpm add convex
pnpm exec convex dev
```

The first `convex dev` run signs in, creates or selects a project, writes `CONVEX_DEPLOYMENT` to `.env.local`, creates
the `convex/` directory, generates types, and watches backend functions. Common commands:

```powershell
pnpm exec convex dev
pnpm exec convex dashboard
pnpm exec convex data
pnpm exec convex logs
pnpm exec convex env list
pnpm exec convex codegen
pnpm exec convex deploy
```

Use `convex dev` for the active development deployment. Use `convex deploy` with `CONVEX_DEPLOY_KEY` in CI for
production. A preview deploy key can create an isolated deployment:

```powershell
pnpm exec convex deploy --preview-create my-branch-name
```

Commit `convex/_generated` so the application can type-check without contacting a deployment. Keep deployment keys in
the approved secret store.

Convex also provides a beta MCP server:

```powershell
pnpm exec convex mcp
```

Configure the MCP server separately in the editor or agent host. Prefer development deployment access and grant
production access only when required.

### Courier CLI

**Use cases:** sending agent notifications when human assistance is required or when tracked work is completed.

```powershell
npm install --global @trycourier/cli
courier --version
```

Configure `COURIER_API_KEY` through the approved secret mechanism. Send notifications using the repository's Courier
skill when one exists rather than duplicating payloads across agents:

```powershell
courier send message --message '<JSON message>'
```

Treat the returned `requestId` as acceptance by Courier, not proof of delivery.

## Project-local engineering tools

Declare these tools in `devDependencies`, lock them with pnpm, and expose routine operations through package scripts:

| Tool                   | Primary use cases                                       |
| ---------------------- | ------------------------------------------------------- |
| Turborepo              | Monorepo task orchestration and caching                 |
| Vite                   | Development server and application builds               |
| Vitest                 | Unit, integration, and coverage tests                   |
| Playwright             | Browser automation and end-to-end tests                 |
| Storybook              | Isolated component development and browser tests        |
| TypeScript             | Static type checking and declaration generation         |
| Oxlint                 | JavaScript and TypeScript linting                       |
| Oxfmt                  | Deterministic source formatting                         |
| Knip                   | Unused file, dependency, and export detection           |
| Lefthook               | Repository Git hooks and verification gates             |
| Beachball              | Package versioning, changelogs, and publishing          |
| npm-run-all2           | Running package scripts in parallel or sequence         |
| Drizzle Kit            | SQL schema generation and migrations when using Drizzle |
| GraphQL Code Generator | Typed GraphQL operations and API models                 |

Install the repository dependencies and use its declared scripts:

```powershell
pnpm install
pnpm verify
pnpm build
```

Install Playwright browser binaries when they are not cached:

```powershell
pnpm exec playwright install
```

## AI access beyond CLIs

CLI installation does not reproduce all agent capabilities. Configure MCP servers, VS Code tools, skills, and agent
definitions separately. Typical integrations include Linear issue management, Shopify documentation and validation,
browser automation, design tools, and Courier notification instructions.

For each new project:

1. Install and authenticate the required machine-level CLIs.
2. Add project-local CLIs to the package manifest and lockfile.
3. Configure required MCP servers and workspace agent customizations.
4. Store credentials in approved local and CI secret stores.
5. Add package scripts for repeatable local, agent, and CI execution.
6. Verify each integration with a harmless read-only command before granting write or deployment access.
