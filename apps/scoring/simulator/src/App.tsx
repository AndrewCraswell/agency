import {
  Activity,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CircleX,
  ClipboardCheck,
  Cpu,
  Download,
  Ellipsis,
  FlaskConical,
  Gauge,
  LoaderCircle,
  Moon,
  Pause,
  Play,
  ScanLine,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Square,
  Sun,
  Volume2,
  Wrench
} from "lucide-react"
import { useEffect, useState, type ReactElement } from "react"
import { DeveloperDisplay } from "@/components/DeveloperDisplay"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatTime, formatWeapon } from "@/format"
import { fetchSimulatorReport, isExecutableCase, type SimulatorCase, type SimulatorReport } from "@/simulator-api"
import { projectObservatoryIdentity } from "../../src/observatory-identity"
import {
  createScenarioDisplayTimeline,
  isScenarioDisplayDecision,
  projectScenarioDisplay,
  type ScenarioDisplayEvent
} from "../../src/scenario-display-projection"

type RunState = "error" | "idle" | "replaying" | "running"
type Theme = "dark" | "light"
type SuiteReplay = Readonly<{ index: number; keys: readonly string[] }>
type TestProgress = "not-run" | "replaying"

type AppTooltipProps = {
  children: ReactElement
  content: string
}

function AppTooltip({ children, content }: AppTooltipProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  )
}

function runSuiteLabel(runState: RunState) {
  if (runState === "running") return "Running suite"
  if (runState === "replaying") return "Stop replay"
  if (runState === "error") return "Retry suite"
  return "Run suite"
}

function runSuiteTooltip(runState: RunState) {
  if (runState === "running") return "The runner is executing every scenario"
  if (runState === "replaying") return "Stop automatic replay and show the completed results"
  return "Run every executable scenario. Planned requirements remain separate"
}

function runSuiteIcon(runState: RunState) {
  if (runState === "running") return <LoaderCircle aria-hidden="true" className="animate-spin" />
  if (runState === "replaying") return <Square aria-hidden="true" />
  return <Play aria-hidden="true" />
}

function caseKey(testCase: SimulatorCase) {
  const identity = projectObservatoryIdentity(testCase)
  return `${identity.kind}:${identity.id}`
}

function titleFor(testCase: SimulatorCase) {
  if (isExecutableCase(testCase))
    return testCase.scenario.title ?? testCase.scenario.description ?? testCase.scenario.scenarioId
  return testCase.scenario.description ?? testCase.scenario.traceabilityId
}

function eventLabel(event: ScenarioDisplayEvent) {
  if (event.kind === "input") return "Input"
  if (event.kind === "expected") return "Expected assertion"
  if (event.kind === "output") return "Authoritative output"
  if (event.kind === "diagnostic") return "Diagnostic"
  if (event.kind === "rejection") return "Rejection"
  return "Uncertainty"
}

function eventEvidence(event: ScenarioDisplayEvent) {
  if (event.kind === "input") return event.id
  const value = event.value
  if (typeof value === "object" && value !== null && "sourceInputIds" in value) {
    const sourceInputIds = value.sourceInputIds
    if (Array.isArray(sourceInputIds) && sourceInputIds.every((id) => typeof id === "string"))
      return sourceInputIds.join(", ")
  }
  return "—"
}

function eventSide(event: ScenarioDisplayEvent) {
  return isScenarioDisplayDecision(event.value) ? event.value.side : undefined
}

function eventKindIcon(kind: ScenarioDisplayEvent["kind"]) {
  const baseClass = "grid size-6 place-items-center rounded-md border [&_svg]:size-3.5"
  if (kind === "input")
    return (
      <span aria-hidden="true" className={`${baseClass} border-border bg-muted text-muted-foreground`}>
        <ScanLine />
      </span>
    )
  if (kind === "expected")
    return (
      <span
        aria-hidden="true"
        className={`${baseClass} border-dashed border-[var(--cp-accent)] bg-[var(--cp-accent-soft)] text-[var(--cp-accent)]`}
      >
        <ClipboardCheck />
      </span>
    )
  if (kind === "output")
    return (
      <span
        aria-hidden="true"
        className={`${baseClass} border-[var(--cp-link)] bg-[var(--cp-info-soft)] text-[var(--cp-link)]`}
      >
        <Activity />
      </span>
    )
  if (kind === "diagnostic")
    return (
      <span aria-hidden="true" className={`${baseClass} border-warning bg-warning-muted text-warning-foreground`}>
        <Wrench />
      </span>
    )
  if (kind === "rejection")
    return (
      <span
        aria-hidden="true"
        className={`${baseClass} rounded-full border-destructive bg-destructive-muted text-destructive-foreground`}
      >
        <CircleX />
      </span>
    )
  return (
    <span
      aria-hidden="true"
      className={`${baseClass} rounded-full border-dashed border-warning bg-warning-muted text-warning-foreground`}
    >
      <CircleHelp />
    </span>
  )
}

function eventAccessibleName(event: ScenarioDisplayEvent) {
  const side = eventSide(event)
  const sideLabel = side === undefined ? "" : `, ${side}`
  const declared = formatTime(event.atUs)
  if (event.atUs !== event.playbackAtUs)
    return `${eventLabel(event)}: ${event.label}${sideLabel}. Declared ${declared}; playback ${formatTime(event.playbackAtUs)}.`
  return `${eventLabel(event)}: ${event.label}${sideLabel} at ${declared}.`
}

function evaluationStatus(testCase: SimulatorCase, progress?: TestProgress) {
  if (progress === "replaying")
    return (
      <span className="inline-flex items-center gap-1 text-[var(--cp-link)]">
        <LoaderCircle aria-hidden="true" className="size-3 animate-spin" />
        Replaying
      </span>
    )
  if (progress === "not-run")
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <CircleDashed aria-hidden="true" className="size-3" />
        Not run
      </span>
    )
  if (testCase.status === "passed")
    return (
      <span className="inline-flex items-center gap-1 text-success-foreground">
        <CircleCheck aria-hidden="true" className="size-3" />
        Passed
      </span>
    )
  if (testCase.status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-destructive-foreground">
        <CircleX aria-hidden="true" className="size-3" />
        Failed
      </span>
    )
  if (testCase.status === "planned-requirement")
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <CircleHelp aria-hidden="true" className="size-3" />
        Evidence pending
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <CircleDashed aria-hidden="true" className="size-3" />
      Not run
    </span>
  )
}
import { formatEventSpan } from "./format"

function durationFor(testCase: SimulatorCase) {
  if (!isExecutableCase(testCase) || testCase.scenario.inputs.length === 0) return "—"
  return formatEventSpan(Math.max(...testCase.scenario.inputs.map((input) => input.atUs)))
}

function suiteNotRunCount(runState: RunState, suiteReplay: SuiteReplay | null, executableCount: number) {
  if (runState === "running") return executableCount
  if (suiteReplay === null) return 0
  return Math.max(0, suiteReplay.keys.length - suiteReplay.index - 1)
}

export function App() {
  const [report, setReport] = useState<SimulatorReport | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [eventIndex, setEventIndex] = useState(-1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [query, setQuery] = useState("")
  const [weapon, setWeapon] = useState("all")
  const [runState, setRunState] = useState<RunState>("idle")
  const [suiteReplay, setSuiteReplay] = useState<SuiteReplay | null>(null)
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCurrent = true
    fetchSimulatorReport("/api/run")
      .then((nextReport) => {
        if (!isCurrent) return
        setReport(nextReport)
        setSelectedKey(nextReport.cases[0] === undefined ? null : caseKey(nextReport.cases[0]))
      })
      .catch(() => {
        if (isCurrent) setError("Couldn’t load scenarios.")
      })
    return () => {
      isCurrent = false
    }
  }, [])

  const selectedCase = report?.cases.find((testCase) => caseKey(testCase) === selectedKey) ?? null
  const executableCase = selectedCase !== null && isExecutableCase(selectedCase) ? selectedCase : null
  const timeline = executableCase === null ? [] : createScenarioDisplayTimeline(executableCase)
  const projection = executableCase === null ? null : projectScenarioDisplay(executableCase, eventIndex)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleCases =
    report?.cases.filter((testCase) => {
      const identity = projectObservatoryIdentity(testCase)
      const matchesWeapon = weapon === "all" || testCase.scenario.weapon === weapon
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [
          identity.id,
          titleFor(testCase),
          testCase.scenario.description,
          ...(testCase.status === "planned-requirement" ? testCase.scenario.scenarioIds : [])
        ]
          .filter((value) => value !== undefined)
          .some((value) => value.toLocaleLowerCase().includes(normalizedQuery))
      return matchesWeapon && matchesQuery
    }) ?? []
  const activeReplayKey = suiteReplay?.keys[suiteReplay.index]
  const executableCount = report?.cases.filter(isExecutableCase).length ?? 0
  const notRunCount = suiteNotRunCount(runState, suiteReplay, executableCount)

  function testProgress(testCase: SimulatorCase): TestProgress | undefined {
    if (!isExecutableCase(testCase)) return undefined
    if (runState === "running") return "not-run"
    if (suiteReplay === null) return undefined
    const replayIndex = suiteReplay.keys.indexOf(caseKey(testCase))
    if (replayIndex === suiteReplay.index) return "replaying"
    return replayIndex > suiteReplay.index ? "not-run" : undefined
  }

  useEffect(() => {
    if (!isPlaying || timeline.length === 0) return
    const timer = window.setInterval(
      () => setEventIndex((current) => Math.min(current + 1, timeline.length - 1)),
      650 / playbackSpeed
    )
    return () => window.clearInterval(timer)
  }, [isPlaying, playbackSpeed, timeline.length])

  useEffect(() => {
    if (!isPlaying || eventIndex < timeline.length - 1) return
    if (suiteReplay !== null && suiteReplay.index + 1 < suiteReplay.keys.length) {
      setIsPlaying(false)
      setSuiteReplay({ ...suiteReplay, index: suiteReplay.index + 1 })
      return
    }
    setIsPlaying(false)
    if (suiteReplay !== null) {
      setSuiteReplay(null)
      setRunState("idle")
    }
  }, [eventIndex, isPlaying, suiteReplay, timeline.length])

  useEffect(() => {
    if (suiteReplay === null) return
    const targetKey = suiteReplay.keys[suiteReplay.index]
    if (targetKey === undefined) {
      setSuiteReplay(null)
      setRunState("idle")
      return
    }
    setSelectedKey(targetKey)
    setEventIndex(-1)
    setIsPlaying(true)
  }, [suiteReplay])

  async function runAll() {
    setSuiteReplay(null)
    setIsPlaying(false)
    setEventIndex(-1)
    setRunState("running")
    setError(null)
    try {
      const nextReport = await fetchSimulatorReport("/api/run", { method: "POST" })
      setReport(nextReport)
      const keys = nextReport.cases.filter(isExecutableCase).map(caseKey)
      if (keys.length === 0) {
        setRunState("idle")
        return
      }
      setRunState("replaying")
      setSuiteReplay({ index: 0, keys })
    } catch {
      setError("Couldn’t run the tests.")
      setRunState("error")
    }
  }

  function stopSuiteReplay() {
    setSuiteReplay(null)
    setIsPlaying(false)
    setRunState("idle")
  }

  function exportTrace() {
    if (report === null) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }))
    const link = document.createElement("a")
    link.download = `scoring-report-${report.reportId.slice("sha256:".length)}.json`
    link.href = url
    link.click()
    URL.revokeObjectURL(url)
  }

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light"
    document.documentElement.setAttribute("data-theme", nextTheme)
    setTheme(nextTheme)
  }

  function selectEvent(index: number) {
    if (suiteReplay !== null) stopSuiteReplay()
    setIsPlaying(false)
    setEventIndex(index)
  }

  function selectCase(key: string) {
    if (suiteReplay !== null) stopSuiteReplay()
    setSelectedKey(key)
    setEventIndex(-1)
    setIsPlaying(false)
  }

  return (
    <div className="flex h-svh min-h-[640px] flex-col overflow-hidden bg-background text-foreground">
      <header className="flex h-14 items-center justify-between overflow-hidden border-b border-border bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <Activity aria-hidden="true" className="size-4" />
          </span>
          <h1 className="text-sm font-semibold">Scoring simulator</h1>
          <Badge
            aria-label="Local environment"
            className="h-[18px] rounded-[6px] border-border bg-muted px-2 py-0 text-[11.5px] leading-none font-medium text-muted-foreground"
            variant="outline"
          >
            Local
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <AppTooltip content="Download the complete simulator report as JSON">
            <Button
              className="hidden sm:inline-flex"
              disabled={report === null}
              onClick={exportTrace}
              size="sm"
              variant="outline"
            >
              <Download aria-hidden="true" />
              Export report
            </Button>
          </AppTooltip>
          <AppTooltip content={runSuiteTooltip(runState)}>
            <Button
              disabled={runState === "running"}
              onClick={runState === "replaying" ? stopSuiteReplay : runAll}
              size="sm"
            >
              {runSuiteIcon(runState)}
              <span aria-live="polite">{runSuiteLabel(runState)}</span>
            </Button>
          </AppTooltip>
          <DropdownMenu>
            <AppTooltip content="More actions">
              <DropdownMenuTrigger asChild>
                <Button aria-label="More actions" size="icon" variant="ghost">
                  <Ellipsis aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
            </AppTooltip>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={toggleTheme}>
                {theme === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
                {theme === "light" ? "Dark theme" : "Light theme"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {error === null ? null : (
        <div
          className="flex items-center gap-2 border-b border-destructive bg-card px-4 py-2 text-sm text-destructive"
          role="alert"
        >
          <AlertTriangle aria-hidden="true" className="size-4" />
          {error}
        </div>
      )}
      <main className="grid min-h-0 flex-1 gap-5 overflow-auto p-5 xl:grid-cols-[minmax(0,1fr)_380px] min-[1400px]:overflow-hidden">
        <div className="grid w-full min-w-0 max-w-full content-start gap-4 min-[1400px]:min-h-0 min-[1400px]:grid-rows-[600px_52px_300px]">
          <section className="overflow-hidden rounded-[14px] border border-border bg-card pb-5 shadow-sm min-[1400px]:min-h-0">
            {executableCase === null || projection === null ? (
              <div className="grid min-h-96 place-items-center p-8 text-center text-sm text-muted-foreground">
                {selectedCase?.status === "planned-requirement" ? (
                  <div className="grid max-w-2xl gap-2">
                    <p>Full requirement evidence is pending.</p>
                    <p>Partial executable scenarios: {selectedCase.scenario.scenarioIds.join(", ")}</p>
                  </div>
                ) : (
                  "Loading scenarios."
                )}
              </div>
            ) : (
              <>
                <header className="flex min-h-[84px] flex-col items-start justify-between gap-2 px-5 py-4 md:flex-row md:items-center md:gap-4">
                  <div className="w-full min-w-0 max-w-full flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <FlaskConical aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <AppTooltip content={titleFor(executableCase)}>
                        <h2 className="truncate text-base font-semibold">{titleFor(executableCase)}</h2>
                      </AppTooltip>
                      {runState === "replaying" && selectedKey === activeReplayKey ? (
                        <Badge className="shrink-0" variant="secondary">
                          <LoaderCircle aria-hidden="true" className="animate-spin" />
                          Replaying
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 flex-wrap items-center gap-2 md:w-auto md:flex-nowrap">
                    <AppTooltip content="Firmware version">
                      <Badge
                        aria-label="Device FA-07, revision 2.1"
                        className="h-[22px] rounded-[10px] px-2.5 py-0 font-mono text-xs text-muted-foreground [&_svg]:size-3"
                        tabIndex={0}
                        variant="secondary"
                      >
                        <Cpu aria-hidden="true" />
                        FA-07 REV 2.1
                      </Badge>
                    </AppTooltip>
                    <AppTooltip content="Replay sound isn’t available yet">
                      <span className="inline-flex">
                        <Button aria-label="Replay sound" disabled size="icon" variant="secondary">
                          <Volume2 aria-hidden="true" />
                        </Button>
                      </span>
                    </AppTooltip>
                    <AppTooltip content="Display settings aren’t available yet">
                      <span className="inline-flex">
                        <Button aria-label="Display settings" disabled size="icon" variant="outline">
                          <SlidersHorizontal aria-hidden="true" />
                        </Button>
                      </span>
                    </AppTooltip>
                  </div>
                </header>
                <div className="mx-5">
                  <DeveloperDisplay projection={projection} />
                </div>
                <div className="mx-5 mt-4 h-[50px]">
                  <dl className="flex h-[50px] w-fit items-center gap-4 rounded-lg border border-border bg-muted px-4 py-2 font-mono">
                    <div className="grid gap-0.5">
                      <dt className="text-[10px] tracking-[1.2px] text-muted-foreground">LOCKOUT</dt>
                      <dd className="flex items-end gap-1">
                        <span className="text-base leading-[1.2] font-semibold">
                          {executableCase.timing.lockoutUs === undefined ? "—" : executableCase.timing.lockoutUs / 1000}
                        </span>
                        <small className="text-xs leading-6 text-muted-foreground">ms</small>
                      </dd>
                    </div>
                    <span aria-hidden="true" className="h-7 w-px bg-border" />
                    <div aria-label="Contact minimum" className="grid gap-0.5">
                      <dt className="text-[10px] tracking-[1.2px] text-muted-foreground">CONTACT</dt>
                      <dd className="flex items-end gap-1">
                        <span className="text-base leading-[1.2] font-semibold">
                          {executableCase.timing.contactMinimumUs === undefined
                            ? "—"
                            : executableCase.timing.contactMinimumUs / 1000}
                        </span>
                        <small className="text-xs leading-6 text-muted-foreground">ms</small>
                      </dd>
                    </div>
                  </dl>
                </div>
              </>
            )}
          </section>

          <section
            className="flex h-[52px] w-full min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-[14px] border border-border bg-muted px-4"
            aria-label="Playback controls"
          >
            <div className="flex shrink-0 items-center gap-[5px]">
              <AppTooltip content="Return to the state before the first event">
                <Button
                  aria-label="Restart replay"
                  disabled={timeline.length === 0}
                  onClick={() => selectEvent(-1)}
                  size="icon-sm"
                  variant="outline"
                >
                  <RotateCcw aria-hidden="true" />
                </Button>
              </AppTooltip>
              <AppTooltip content="Show the previous event">
                <Button
                  aria-label="Previous event"
                  disabled={eventIndex < 0}
                  onClick={() => selectEvent(eventIndex - 1)}
                  size="icon-sm"
                  variant="outline"
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
              </AppTooltip>
              <AppTooltip content={isPlaying ? "Pause automatic replay" : "Play events automatically"}>
                <Button
                  aria-label={isPlaying ? "Pause replay" : "Play replay"}
                  disabled={timeline.length === 0}
                  onClick={() => setIsPlaying((current) => !current)}
                  size="icon-play"
                >
                  {isPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
                </Button>
              </AppTooltip>
              <AppTooltip content="Show the next event">
                <Button
                  aria-label="Next event"
                  disabled={eventIndex >= timeline.length - 1}
                  onClick={() => selectEvent(eventIndex + 1)}
                  size="icon-sm"
                  variant="outline"
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </AppTooltip>
              <AppTooltip content="Mismatch navigation isn’t available yet">
                <span>
                  <Button aria-label="Next mismatch" disabled size="icon-sm" variant="outline">
                    <CircleAlert aria-hidden="true" />
                  </Button>
                </span>
              </AppTooltip>
            </div>
            <AppTooltip content="Set the automatic replay speed">
              <label className="relative flex items-center text-xs text-muted-foreground">
                <span className="sr-only">Playback speed</span>
                <Gauge aria-hidden="true" className="pointer-events-none absolute left-2 size-3.5" />
                <select
                  aria-label="Playback speed"
                  className="h-[30px] w-[73px] rounded-md border border-input bg-background pr-2 pl-7 text-foreground"
                  onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
                  value={playbackSpeed}
                >
                  {[0.25, 0.5, 1, 2].map((speed) => (
                    <option key={speed} value={speed}>
                      {speed}x
                    </option>
                  ))}
                </select>
              </label>
            </AppTooltip>
            <AppTooltip content="Jump to an event in the replay">
              <input
                aria-label="Playback position"
                className="mx-3 hidden h-1 min-w-24 flex-1 accent-[var(--cp-text)] sm:block"
                max={Math.max(0, timeline.length - 1)}
                min={-1}
                onChange={(event) => selectEvent(Number(event.target.value))}
                type="range"
                value={eventIndex}
              />
            </AppTooltip>
            <div className="ml-auto hidden items-center gap-4 font-mono text-[11px] sm:flex">
              <span>
                <small className="mr-1 text-muted-foreground">Event</small>
                {Math.max(0, eventIndex + 1)} of {timeline.length}
              </span>
              <span>
                <small className="mr-1 text-muted-foreground">Declared time</small>
                {projection?.event === null || projection === null ? "—" : formatTime(projection.event.atUs)}
              </span>
            </div>
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm">
            <header className="flex min-h-[50px] flex-col items-stretch justify-between gap-2 border-b border-border px-4 py-2.5 sm:h-[50px] sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-[13.5px] font-semibold">Scenarios and requirements</h2>
                <span className="rounded-[5px] bg-muted px-1.5 py-0.5 font-mono text-[10.5px] leading-none text-muted-foreground">
                  {visibleCases.length}
                </span>
              </div>
              <div className="flex w-full min-w-0 justify-end gap-2 sm:w-auto sm:flex-none">
                <AppTooltip content="Search scenario titles and identifiers">
                  <label className="relative min-w-0 flex-1 sm:w-[200px] sm:flex-none">
                    <Search aria-hidden="true" className="absolute top-2 left-2.5 size-[13px] text-muted-foreground" />
                    <span className="sr-only">Search scenarios</span>
                    <Input
                      className="h-[30px] rounded-lg pr-2.5 pl-[30px] text-[12.5px]"
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search scenarios"
                      value={query}
                    />
                  </label>
                </AppTooltip>
                <AppTooltip content="Show scenarios for one weapon">
                  <label>
                    <span className="sr-only">Filter by weapon</span>
                    <select
                      className="h-[30px] w-[112px] shrink-0 rounded-lg border border-input bg-background px-2.5 text-[12.5px] font-medium"
                      onChange={(event) => setWeapon(event.target.value)}
                      value={weapon}
                    >
                      <option value="all">All weapons</option>
                      <option value="epee">Epee</option>
                      <option value="foil">Foil</option>
                      <option value="sabre">Sabre</option>
                    </select>
                  </label>
                </AppTooltip>
                <AppTooltip content="Failed-only runs aren’t available yet">
                  <span className="hidden md:inline-flex">
                    <Button className="h-[30px] rounded-[10px] px-2.5 text-[12.5px]" disabled variant="outline">
                      <RefreshCw aria-hidden="true" />
                      Rerun failed
                    </Button>
                  </span>
                </AppTooltip>
              </div>
            </header>
            <div className="h-[200px] max-w-full overflow-auto min-[1400px]:h-auto min-[1400px]:flex-1">
              <table className="w-[720px] table-fixed border-collapse text-left text-xs md:w-full md:min-w-0">
                <thead className="sticky top-0 bg-muted text-muted-foreground">
                  <tr className="h-[30px] text-[10px] uppercase">
                    <th className="w-[88px] px-3 font-medium">Status</th>
                    <th className="px-3 font-medium">Scenario or requirement</th>
                    <th className="w-[62px] px-3 font-medium">Weapon</th>
                    <th className="w-[88px] whitespace-nowrap px-3 text-right font-medium">Event span</th>
                    <th className="w-10" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {visibleCases.map((testCase) => {
                    const identity = projectObservatoryIdentity(testCase)
                    const isSelected = caseKey(testCase) === selectedKey
                    return (
                      <tr
                        className={`h-[34px] border-t border-border ${isSelected ? "border-l-2 border-l-primary bg-foreground/[.05]" : "hover:bg-muted"}`}
                        key={caseKey(testCase)}
                      >
                        <td className="w-[88px] px-3 text-[11.5px] font-semibold">
                          {evaluationStatus(testCase, testProgress(testCase))}
                        </td>
                        <td className="min-w-0 p-0">
                          <AppTooltip content={titleFor(testCase)}>
                            <button
                              aria-current={isSelected ? "true" : undefined}
                              className="block w-full truncate px-3 text-left text-[12.5px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              onClick={() => selectCase(caseKey(testCase))}
                              type="button"
                            >
                              {titleFor(testCase)}
                            </button>
                          </AppTooltip>
                        </td>
                        <td className="w-[62px] px-3">
                          <Badge variant="outline">{formatWeapon(testCase.scenario.weapon)}</Badge>
                        </td>
                        <td className="w-[88px] whitespace-nowrap px-3 text-right font-mono text-[11px]">
                          {durationFor(testCase)}
                        </td>
                        <td className="w-10 text-center">
                          <AppTooltip content="Scenario actions aren’t available yet">
                            <span>
                              <Button
                                aria-label={`More actions for ${identity.id}`}
                                disabled
                                size="icon-xs"
                                variant="ghost"
                              >
                                <Ellipsis aria-hidden="true" />
                              </Button>
                            </span>
                          </AppTooltip>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <footer className="flex h-10 items-center overflow-hidden border-t border-border bg-muted px-4 text-[11px] text-muted-foreground">
              <span className="flex min-w-0 items-center gap-3.5">
                <span className="whitespace-nowrap">
                  <strong className="font-mono text-foreground">{visibleCases.length}</strong> of{" "}
                  <strong className="font-mono text-foreground">{report?.cases.length ?? 0}</strong> items shown
                </span>
                <span aria-hidden="true" className="hidden h-3.5 w-px bg-border sm:block" />
                <span className="hidden items-center gap-3.5 font-mono sm:flex">
                  <span className="flex items-center gap-1.5">
                    <strong className="font-mono text-foreground">{report?.summary.executable.total ?? 0}</strong>{" "}
                    executable
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i aria-hidden="true" className="relative -top-px size-1.5 rounded-full bg-success" />
                    <strong className="font-mono text-success-foreground">
                      {report?.summary.executable.passed ?? 0}
                    </strong>{" "}
                    passed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i aria-hidden="true" className="relative -top-px size-1.5 rounded-full bg-destructive" />
                    <strong className="font-mono text-destructive-foreground">
                      {report?.summary.executable.failed ?? 0}
                    </strong>{" "}
                    failed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i aria-hidden="true" className="relative -top-px size-1.5 rounded-full bg-muted-foreground" />
                    <strong className="font-mono text-muted-foreground">{notRunCount}</strong> not run
                  </span>
                  <span className="flex items-center gap-1.5">
                    <i aria-hidden="true" className="relative -top-px size-1.5 rounded-full bg-border" />
                    <strong className="font-mono text-muted-foreground">
                      {report?.summary.plannedRequirements ?? 0}
                    </strong>{" "}
                    requirements pending
                  </span>
                </span>
              </span>
            </footer>
          </section>
        </div>

        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-[14px] border border-border bg-card shadow-sm xl:min-h-0">
          <header className="min-h-[79px] border-b border-border px-[14px] py-3">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold">Event timeline</h2>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {timeline.length} events over{" "}
                  {timeline.length === 0 ? "0 us" : formatTime(timeline.at(-1)?.playbackAtUs ?? 0)}
                </p>
              </div>
              <div className="flex gap-1">
                <AppTooltip content="Event filters aren’t available yet">
                  <span>
                    <Button aria-label="Filter events" disabled size="icon-xs" variant="ghost">
                      <SlidersHorizontal aria-hidden="true" />
                    </Button>
                  </span>
                </AppTooltip>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-[9px] text-muted-foreground">
              <span className="flex items-center gap-1">{eventKindIcon("input")} Input</span>
              <span className="flex items-center gap-1">{eventKindIcon("expected")} Expected</span>
              <span className="flex items-center gap-1">{eventKindIcon("output")} Output</span>
              <span className="flex items-center gap-1">{eventKindIcon("diagnostic")} Diagnostic</span>
              <span className="flex items-center gap-1">{eventKindIcon("rejection")} Rejection</span>
              <span className="flex items-center gap-1">{eventKindIcon("uncertainty")} Uncertainty</span>
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-auto">
            {timeline.map((event, index) => (
              <AppTooltip content={`${eventLabel(event)}: ${event.label}`} key={`${event.kind}:${event.id}`}>
                <button
                  aria-label={eventAccessibleName(event)}
                  aria-current={index === eventIndex ? "true" : undefined}
                  className={`grid min-h-[42px] w-full grid-cols-[44px_24px_1fr_16px] items-center gap-2 border-b border-border px-[14px] py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring ${index === eventIndex ? "bg-foreground/[.05]" : "hover:bg-muted"}`}
                  onClick={() => selectEvent(index)}
                  type="button"
                >
                  <span className="font-mono text-[10px] text-muted-foreground">{formatTime(event.playbackAtUs)}</span>
                  {eventKindIcon(event.kind)}
                  <span className="min-w-0">
                    <span className="block truncate text-[11px]">{event.label}</span>
                  </span>
                  <span
                    className={`text-center text-[10px] font-semibold ${eventSide(event) === "left" ? "text-destructive-foreground" : "text-success-foreground"}`}
                  >
                    {eventSide(event) === "left" ? "L" : eventSide(event) === "right" ? "R" : ""}
                  </span>
                </button>
              </AppTooltip>
            ))}
          </div>
          <section className="min-h-[164px] border-t border-border bg-muted p-[14px]" aria-live="polite">
            {projection?.event === null || projection === null ? (
              <p className="text-xs text-muted-foreground">
                Select an event to view its timing, evidence, and display changes.
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">
                      Event {projection.eventNumber} of {projection.eventCount}
                    </h3>
                    <Badge variant="outline">{eventLabel(projection.event)}</Badge>
                  </div>
                </div>
                <dl className="mt-3 grid gap-2 text-xs">
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="text-muted-foreground">Display change</dt>
                    <dd>{projection.event.label}</dd>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="text-muted-foreground">Declared time</dt>
                    <dd className="font-mono">{formatTime(projection.event.atUs)}</dd>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="text-muted-foreground">Playback time</dt>
                    <dd className="font-mono">{formatTime(projection.event.playbackAtUs)}</dd>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="text-muted-foreground">Source inputs</dt>
                    <dd className="font-mono">{eventEvidence(projection.event)}</dd>
                  </div>
                  <div className="grid grid-cols-[110px_1fr] gap-2">
                    <dt className="text-muted-foreground">Score and clock</dt>
                    <dd className="text-muted-foreground">Not recorded</dd>
                  </div>
                </dl>
                {executableCase !== null && executableCase.result.mismatches.length > 0 ? (
                  <AppTooltip content="Mismatch details aren’t available yet">
                    <span className="mt-3 block">
                      <Button className="w-full justify-start" disabled size="sm" variant="ghost">
                        <CircleX aria-hidden="true" className="size-3" />
                        View mismatch
                      </Button>
                    </span>
                  </AppTooltip>
                ) : null}
              </>
            )}
          </section>
        </aside>
      </main>
    </div>
  )
}
