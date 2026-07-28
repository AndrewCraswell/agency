import { Link } from "@tanstack/react-router"

export function NotFoundPage() {
  return (
    <div className="notfound">
      <h1>No such template</h1>
      <p>That preview link points at a template or variation the registry doesn&rsquo;t have.</p>
      <Link className="btn" to="/">
        All templates
      </Link>
    </div>
  )
}
