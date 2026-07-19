import { createServer } from "node:http"

export function createProcessHealthServer() {
  return createServer((request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" })
      response.end('{"status":"ok"}')
      return
    }
    response.writeHead(404)
    response.end()
  })
}
