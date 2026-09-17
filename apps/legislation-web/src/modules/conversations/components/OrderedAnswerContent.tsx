"use client"

import { useDocumentVisibility, useIsomorphicEffect, useReducedMotion } from "@mantine/hooks"
import { useRef, useState, type ReactNode } from "react"
import type { OrderedAnswerPart } from "./orderedAnswer"
import * as styles from "./ConversationResponse.css"

type OrderedAnswerContentProps = Readonly<{
  parts: readonly OrderedAnswerPart[]
  isRunning: boolean
  renderPart: (part: OrderedAnswerPart, animate: boolean) => ReactNode
  children: ReactNode
}>

function textAnimations(element: HTMLElement) {
  return (
    element.getAnimations?.({ subtree: true }).filter((animation) => {
      const effect = animation.effect
      return (
        effect instanceof KeyframeEffect &&
        effect.target instanceof Element &&
        effect.target.hasAttribute("data-sd-animate") &&
        animation.playState !== "finished" &&
        Number.isFinite(Number(effect.getComputedTiming().endTime))
      )
    }) ?? []
  )
}

export function OrderedAnswerContent({ parts, isRunning, renderPart, children }: OrderedAnswerContentProps) {
  const content = useRef<HTMLDivElement>(null)
  const deadline = useRef<{ key: string; at: number } | undefined>(undefined)
  const [released, setReleased] = useState<ReadonlySet<string>>(() => new Set())
  const [motionSuppressed, setMotionSuppressed] = useState(false)
  const isReducedMotion = useReducedMotion()
  const visibility = useDocumentVisibility()
  const animate = isRunning && !isReducedMotion && !motionSuppressed
  const bypass = !animate || visibility === "hidden"
  const nextIndex = bypass ? -1 : parts.findIndex((part) => part.type === "presentation" && !released.has(part.key))
  const nextKey = nextIndex < 0 ? undefined : parts[nextIndex]?.key
  const visibleParts = nextIndex < 0 ? parts : parts.slice(0, nextIndex)

  useIsomorphicEffect(() => {
    if (!content.current) {
      return
    }
    if (!bypass && nextKey === undefined) {
      return
    }
    const animations = textAnimations(content.current)
    if (bypass) {
      if (!animate && !motionSuppressed && parts.some((part) => part.type === "presentation" || part.text.length > 0)) {
        setMotionSuppressed(true)
      }
      deadline.current = undefined
      animations.forEach((animation) => animation.finish())
      const keys = parts.filter((part) => part.type === "presentation").map((part) => part.key)
      if (keys.some((key) => !released.has(key))) {
        setReleased(new Set([...released, ...keys]))
      }
      return
    }
    if (nextKey === undefined) {
      return
    }
    if (deadline.current?.key !== nextKey) {
      deadline.current = { key: nextKey, at: performance.now() + 500 }
    }
    let active = true
    const release = () => {
      if (active) {
        setReleased((current) => new Set([...current, nextKey]))
      }
    }
    if (animations.length === 0) {
      release()
      return
    }
    const timeout = window.setTimeout(
      () => {
        animations.forEach((animation) => {
          if (animation.playState !== "idle" && animation.playState !== "finished") {
            animation.finish()
          }
        })
        release()
      },
      Math.max(0, deadline.current.at - performance.now())
    )
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      window.clearTimeout(timeout)
      release()
    })
    return () => {
      active = false
      window.clearTimeout(timeout)
    }
  }, [parts, bypass, nextKey, released, motionSuppressed, animate])

  return (
    <div ref={content} className={styles.orderedContent}>
      {visibleParts.map((part) => renderPart(part, animate))}
      {nextIndex < 0 && children}
    </div>
  )
}
