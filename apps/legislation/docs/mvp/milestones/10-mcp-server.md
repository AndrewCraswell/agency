# Milestone 10: Remote MCP server

## Goal

Expose the source-independent query service to remote MCP clients through a thin, standards-compliant transport.

## Tasks

### Server foundation

- [ ] **M10.1** Add the official MCP TypeScript SDK using the version approved for implementation.
- [ ] **M10.2** Implement Streamable HTTP at a stable remote endpoint.
- [ ] **M10.3** Implement health and readiness endpoints separately from the MCP endpoint.
- [ ] **M10.4** Configure request body, response, connection, and execution time limits.
- [ ] **M10.5** Implement graceful shutdown that stops accepting work and drains in-flight requests.
- [ ] **M10.6** Attach a correlation ID to every request and return it where the protocol allows.

### Tool registration

- [ ] **M10.7** Register `search_bills` with its locked schema, descriptions, defaults, and limits.
- [ ] **M10.8** Register `get_bill` with canonical lookup and bounded child collections.
- [ ] **M10.9** Register `get_bill_timeline` with chronology and pagination options.
- [ ] **M10.10** Register `search_bill_text` with corpus, bill, version, and retrieval-mode options.
- [ ] **M10.11** Register `get_bill_text` with version and section pagination.
- [ ] **M10.12** Register `compare_bill_versions` with explicit version identifiers.
- [ ] **M10.13** Register `find_related_bills` with explicit and optional semantic methods.
- [ ] **M10.14** Keep each handler limited to validation, context setup, query-service invocation, and response mapping.

### Response and error behavior

- [ ] **M10.15** Map query-service results into predictable MCP structured content.
- [ ] **M10.16** Include canonical IDs and official source links in every relevant tool result.
- [ ] **M10.17** Enforce hard payload limits after serialization, not only before querying.
- [ ] **M10.18** Provide pagination or truncation metadata whenever content is omitted.
- [ ] **M10.19** Map validation, not-found, unsupported, temporary, and internal failures consistently.
- [ ] **M10.20** Prevent database details, secrets, stack traces, and provider credentials from reaching clients.
- [ ] **M10.21** Log correlation-safe diagnostics for every returned internal error.

### Protocol verification

- [ ] **M10.22** Add schema tests for each tool's accepted and rejected inputs.
- [ ] **M10.23** Add handler tests verifying exact query-service argument mapping.
- [ ] **M10.24** Add response-size and pagination tests using oversized bills and documents.
- [ ] **M10.25** Connect an external MCP inspector or client to the local server.
- [ ] **M10.26** Execute a multi-tool flow: discover a bill, inspect it, review its timeline, search its text, and compare versions.
- [ ] **M10.27** Verify compatibility with at least two target MCP-capable clients before release.
- [ ] **M10.28** Document connection configuration and safe troubleshooting steps.

## Exit criteria

- A remote MCP client discovers and executes all seven tools through Streamable HTTP.
- Tool handlers remain thin and responses remain bounded and source-aware.
- Invalid inputs and operational failures produce stable, safe errors.

