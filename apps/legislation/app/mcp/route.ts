import { handleNextMcpRequest } from "../../src/server/next/mcp-runtime.js"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const POST = handleNextMcpRequest
export const GET = handleNextMcpRequest
export const DELETE = handleNextMcpRequest
