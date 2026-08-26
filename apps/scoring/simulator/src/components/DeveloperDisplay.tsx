import { useEffect, useRef, useState } from "react"
import { formatWeapon } from "@/format"
import type { ScenarioDisplayProjection } from "../../../src/scenario-display-projection"

export type DeveloperDisplayProps = {
  projection: ScenarioDisplayProjection
}

function lampClass(state: ScenarioDisplayProjection["leftLamp"], side: "left" | "right") {
  if (state === "valid-hit")
    return side === "left" ? "score-lamp score-lamp-left is-active" : "score-lamp score-lamp-right is-active"
  if (state === "off-target") return "score-lamp score-lamp-off-target is-active"
  return "score-lamp"
}

function groundIndicatorClass(yellow: "off" | "on", white: "off" | "on", hasFault: boolean) {
  if (yellow === "on") return "status-indicator is-warning"
  if (white === "on" || hasFault) return "status-indicator is-active"
  return "status-indicator"
}

export function DeveloperDisplay({ projection }: DeveloperDisplayProps) {
  const viewportReference = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const viewport = viewportReference.current
    if (viewport === null || typeof ResizeObserver === "undefined") return
    const updateScale = () => {
      if (viewport.clientWidth > 0) setScale(viewport.clientWidth / 960)
    }
    updateScale()
    const observer = new ResizeObserver(updateScale)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      aria-label={`${projection.accessibleLabel}; score, clock, cards, period, and priority not recorded`}
      className="score-viewport"
      ref={viewportReference}
      role="img"
    >
      <div aria-hidden="true" className="machine-bezel" style={{ transform: `scale(${scale})` }}>
        <div className="score-face">
          <div className="score-face-topline">
            <span className="weapon-chip">
              <span aria-hidden="true" className="weapon-led" />
              {formatWeapon(projection.weapon).toUpperCase()}
            </span>
            <span className="review-chip">REVIEW</span>
          </div>

          <div className="score-main-row">
            <div className="score-side">
              <span aria-hidden="true" className={lampClass(projection.leftLamp, "left")} />
              <strong className="score-digits">--</strong>
            </div>
            <div className="score-center">
              <strong className="score-clock">--:--</strong>
              <div className="score-meta">
                <span>
                  <small>PERIOD</small>
                  <strong>—</strong>
                </span>
                <span>
                  <small>PRIORITY</small>
                  <strong>—</strong>
                </span>
              </div>
            </div>
            <div className="score-side">
              <span aria-hidden="true" className={lampClass(projection.rightLamp, "right")} />
              <strong className="score-digits">--</strong>
            </div>
          </div>

          <div className="score-status-strip">
            <div className="score-status-side">
              <span className="penalty-card penalty-card-yellow" />
              <span className="penalty-card penalty-card-red" />
              <span
                className={groundIndicatorClass(
                  projection.leftYellowDiagnostic,
                  projection.leftWhiteDiagnostic,
                  projection.leftFault
                )}
              >
                <i /> L GND
              </span>
            </div>
            <div className="score-center-status">
              <span className="status-indicator">
                <i /> WHIP-OVER
              </span>
            </div>
            <div className="score-status-side is-right">
              <span
                className={groundIndicatorClass(
                  projection.rightYellowDiagnostic,
                  projection.rightWhiteDiagnostic,
                  projection.rightFault
                )}
              >
                <i /> R GND
              </span>
              <span className="penalty-card penalty-card-yellow" />
              <span className="penalty-card penalty-card-red" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
