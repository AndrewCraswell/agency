import { useEffect, useRef } from "react"

type AutoHeightFrameProps = {
  /** A URL to load. Give this or `srcDoc`, not both. */
  src?: string
  /** Markup to load directly, for callers that render the document themselves. */
  srcDoc?: string
  title: string
  className?: string
}

/**
 * An iframe never sizes itself to its content, so the document is measured once it loads and again
 * whenever late-arriving images reflow it. Same-origin, so the document stays readable.
 */
export function AutoHeightFrame({ src, srcDoc, title, className }: AutoHeightFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) {
      return
    }

    let observer: ResizeObserver | undefined

    function fit(): void {
      const root = frame?.contentDocument?.documentElement
      if (frame && root) {
        frame.style.height = `${root.scrollHeight}px`
      }
    }

    function watch(): void {
      fit()
      /*
       * The document element is capped by the frame's own height, so it never reports growth.
       * The body does, which is what late-loading images push around.
       */
      const body = frame?.contentDocument?.body
      if (!body) {
        return
      }
      observer?.disconnect()
      observer = new ResizeObserver(fit)
      observer.observe(body)
    }

    frame.addEventListener("load", watch)
    if (frame.contentDocument?.readyState === "complete") {
      watch()
    }

    return () => {
      frame.removeEventListener("load", watch)
      observer?.disconnect()
    }
  }, [src, srcDoc])

  return <iframe className={className} ref={frameRef} src={src} srcDoc={srcDoc} title={title} />
}
