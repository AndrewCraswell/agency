"use client"

import { LocateFixed } from "lucide-react"
import { useEffect, useId, useRef, useState } from "react"
import { Badge } from "../../../components/ui/badge"
import { Button } from "../../../components/ui/button"
import { Skeleton } from "../../../components/ui/skeleton"
import { representativeLookupResponseSchema, type RepresentativeLookupResult } from "../contracts"

const locationTimeoutMs = 10_000
const requestTimeoutMs = 20_000
const locationTimeoutMessage = "Finding your location took too long. Try again when your device has a location signal."

type LookupState =
  | { status: "idle" | "locating" | "loading" | "cancelled" }
  | { status: "error"; message: string }
  | { status: "complete"; result: RepresentativeLookupResult; accuracy: number | null }

type LookupAttempt = { controller: AbortController; timeout: number | undefined }
type Representative = RepresentativeLookupResult["representatives"][number]

const progressMessages = {
  idle: "Your location has not been requested.",
  locating: "Waiting for your browser to find your location.",
  loading: "Looking up representatives and matching stored profiles.",
  cancelled: "Lookup cancelled. You can try again when you are ready."
}

const resultMessages = {
  matched: {
    title: "Representatives matched",
    description: "The returned representatives match stored Rostra profiles."
  },
  partial: {
    title: "Some matches are incomplete",
    description: "Some representatives or jurisdiction names could not be matched to stored Rostra records."
  },
  no_match: {
    title: "No matching location found",
    description: "Geocodio could not resolve this location to representatives."
  },
  ambiguous: {
    title: "The lookup needs confirmation",
    description: "A single match could not be confirmed. Check the district before relying on these results."
  },
  unsupported: {
    title: "This location is not supported",
    description: "Representative coverage is unavailable for this location."
  }
}

const matchLabels = {
  matched: "Profile matched",
  not_found: "Profile not found",
  ambiguous: "Profile match is ambiguous",
  missing_identifier: "Provider identifier unavailable"
}

const chamberLabels = {
  congress: "Congressional district",
  upper: "State upper chamber",
  lower: "State lower chamber",
  unicameral: "State legislature"
}

function abortAttempt(attempt: LookupAttempt | null) {
  if (attempt) {
    window.clearTimeout(attempt.timeout)
    attempt.controller.abort()
  }
}

export function RepresentativeLookup() {
  const privacyId = useId()
  const attemptRef = useRef<LookupAttempt | null>(null)
  const lookupButtonRef = useRef<HTMLButtonElement>(null)
  const [state, setState] = useState<LookupState>({ status: "idle" })
  const isBusy = state.status === "locating" || state.status === "loading"

  useEffect(
    () => () => {
      abortAttempt(attemptRef.current)
      attemptRef.current = null
    },
    []
  )

  useEffect(() => {
    if (state.status === "cancelled") {
      lookupButtonRef.current?.focus()
    }
  }, [state.status])

  function handleCancel() {
    abortAttempt(attemptRef.current)
    attemptRef.current = null
    setState({ status: "cancelled" })
  }

  function handleLookup() {
    if (attemptRef.current) {
      return
    }
    if (!navigator.geolocation) {
      setState({
        status: "error",
        message: "This browser does not support location access. Try a browser with location services enabled."
      })
      return
    }

    const attempt: LookupAttempt = { controller: new AbortController(), timeout: undefined }
    attemptRef.current = attempt
    setState({ status: "locating" })

    function isCurrentAttempt() {
      return attemptRef.current === attempt && !attempt.controller.signal.aborted
    }

    function fail(message: string) {
      if (!isCurrentAttempt()) {
        return
      }
      abortAttempt(attempt)
      attemptRef.current = null
      setState({ status: "error", message })
    }

    async function handlePosition(position: GeolocationPosition) {
      if (!isCurrentAttempt()) {
        return
      }
      window.clearTimeout(attempt.timeout)
      setState({ status: "loading" })
      attempt.timeout = window.setTimeout(
        () => fail("The representative lookup took too long. Try again."),
        requestTimeoutMs
      )

      try {
        const response = await fetch("/api/dev/representatives", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          }),
          cache: "no-store",
          signal: attempt.controller.signal
        })
        if (!isCurrentAttempt()) {
          return
        }
        if (!response.ok) {
          if (response.status === 503) {
            fail("Representative lookup is unavailable. Check the development server configuration and try again.")
          } else if (response.status === 429) {
            fail("Too many lookup attempts. Wait a moment and try again.")
          } else {
            fail("Representatives could not be loaded. Try again.")
          }
          return
        }

        const body: unknown = await response.json()
        if (!isCurrentAttempt()) {
          return
        }
        const parsed = representativeLookupResponseSchema.safeParse(body)
        if (!parsed.success) {
          fail("Rostra received an unexpected response. Try again.")
          return
        }

        window.clearTimeout(attempt.timeout)
        attemptRef.current = null
        setState({
          status: "complete",
          result: parsed.data.data,
          accuracy:
            Number.isFinite(position.coords.accuracy) && position.coords.accuracy >= 0
              ? Math.ceil(position.coords.accuracy)
              : null
        })
      } catch {
        fail("The lookup could not be completed. Check your connection and try again.")
      }
    }

    attempt.timeout = window.setTimeout(() => fail(locationTimeoutMessage), locationTimeoutMs)
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          void handlePosition(position)
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            fail("Location access was denied. Allow location access in your browser settings, then try again.")
          } else if (error.code === error.TIMEOUT) {
            fail(locationTimeoutMessage)
          } else {
            fail("Your location is unavailable. Check your device location settings and try again.")
          }
        },
        { enableHighAccuracy: false, timeout: locationTimeoutMs, maximumAge: 0 }
      )
    } catch {
      fail("Location access could not be started. Check your browser location settings and try again.")
    }
  }

  let statusMessage = ""
  if (state.status === "complete") {
    statusMessage = resultMessages[state.result.status].title
  } else if (state.status !== "error") {
    statusMessage = progressMessages[state.status]
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 wrap-anywhere sm:px-6 sm:py-10">
      <header className="max-w-2xl space-y-3">
        <Badge variant="outline" className="rounded-md">
          Development only
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Find your representatives</h1>
        <p className="text-muted-foreground">
          Compare representatives returned by Geocodio with stored Rostra profiles.
        </p>
      </header>

      <section aria-label="Location lookup" className="space-y-4">
        <p id={privacyId} className="max-w-2xl text-sm text-muted-foreground">
          Location is requested only when you choose Use my location. Your browser sends coordinates to Geocodio through
          the Rostra server for this lookup. Rostra does not save your location.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            ref={lookupButtonRef}
            type="button"
            onClick={handleLookup}
            disabled={isBusy}
            aria-describedby={privacyId}
            size="lg"
          >
            <LocateFixed aria-hidden="true" />
            Use my location
          </Button>
          {isBusy && (
            <Button type="button" onClick={handleCancel} variant="outline" size="lg">
              Cancel lookup
            </Button>
          )}
        </div>
        <output aria-live="polite" aria-atomic="true" className="block text-sm text-muted-foreground">
          {statusMessage}
        </output>
        {state.status === "error" && (
          <p
            role="alert"
            className="max-w-2xl rounded-md border border-destructive/40 bg-card p-4 text-sm text-destructive"
          >
            {state.message}
          </p>
        )}
      </section>

      {state.status === "loading" && (
        <div aria-label="Loading representatives" aria-busy="true" className="space-y-4">
          <div aria-hidden="true" className="space-y-4 rounded-lg border bg-card p-5">
            <Skeleton className="h-6 w-44 motion-safe:animate-none" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-24 motion-safe:animate-none" />
              <Skeleton className="h-24 motion-safe:animate-none" />
            </div>
          </div>
        </div>
      )}

      {state.status === "complete" && <LookupResults result={state.result} accuracy={state.accuracy} />}
    </main>
  )
}

type LookupResultsProps = Readonly<{ result: RepresentativeLookupResult; accuracy: number | null }>

function LookupResults({ result, accuracy }: LookupResultsProps) {
  const headingId = useId()
  const message = resultMessages[result.status]
  const jurisdictionCodes = new Set([
    ...result.jurisdictions.map((jurisdiction) => jurisdiction.code),
    ...result.representatives.map((representative) => representative.jurisdictionCode)
  ])

  return (
    <section aria-label="Representative lookup results" className="sentry-block space-y-6" data-sentry-block="">
      <div className="space-y-2 border-t pt-6">
        <h2 className="text-xl font-semibold">{message.title}</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">{message.description}</p>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {accuracy !== null && `Browser-reported accuracy: within about ${accuracy.toLocaleString()} meters. `}
          An imprecise location can select the wrong district. Confirm your district with an official election source.
        </p>
      </div>

      {result.warnings.length > 0 && (
        <section aria-label="Lookup warnings" className="space-y-2 rounded-md border bg-card p-4">
          <h3 className="font-semibold">Lookup warnings</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {result.warnings.map((warning, index) => (
              <li key={`${index}:${warning}`}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      {result.representatives.length === 0 && (
        <p className="text-sm text-muted-foreground">No representatives were returned for this location.</p>
      )}

      {Array.from(jurisdictionCodes, (code, index) => {
        const jurisdiction = result.jurisdictions.find((item) => item.code === code)
        const representatives = result.representatives.filter((item) => item.jurisdictionCode === code)
        const jurisdictionHeadingId = `${headingId}-${index}`
        return (
          <section key={code} aria-labelledby={jurisdictionHeadingId} className="space-y-4">
            <div className="space-y-2">
              <h2 id={jurisdictionHeadingId} className="text-xl font-semibold">
                {jurisdiction?.name ?? "Jurisdiction name unavailable"}
              </h2>
              <p className="text-sm text-muted-foreground">Jurisdiction code: {code}</p>
              {jurisdiction && jurisdiction.districts.length > 0 && (
                <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  {jurisdiction.districts.map((district) => (
                    <li key={district.id}>
                      {chamberLabels[district.chamber]}: {district.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-3">
              {representatives.map((representative, representativeIndex) => (
                <RepresentativeDetails
                  key={`${representative.office}:${representative.name}:${representativeIndex}`}
                  representative={representative}
                />
              ))}
              {representatives.length === 0 && (
                <p className="text-sm text-muted-foreground">No representatives were returned for this jurisdiction.</p>
              )}
            </div>
          </section>
        )
      })}
    </section>
  )
}

type RepresentativeDetailsProps = Readonly<{ representative: Representative }>

function RepresentativeDetails({ representative }: RepresentativeDetailsProps) {
  const { profile } = representative
  const headingId = useId()

  return (
    <article aria-labelledby={headingId} className="space-y-5 rounded-lg border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id={headingId} className="text-lg font-semibold">
          {representative.name}
        </h3>
        <Badge variant="secondary" className="rounded-md">
          {matchLabels[representative.matchStatus]}
        </Badge>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <section aria-label={`Geocodio details for ${representative.name}`} className="min-w-0 space-y-3">
          <h4 className="text-sm font-semibold">Geocodio result</h4>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Office</dt>
              <dd>{representative.office}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">District</dt>
              <dd>{representative.districtName}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Party</dt>
              <dd>{representative.party ?? "Party unavailable"}</dd>
            </div>
          </dl>
          {representative.officialUrl && (
            <OfficialLink href={representative.officialUrl} label="Official website from Geocodio" />
          )}
        </section>
        <section aria-label={`Stored profile for ${representative.name}`} className="min-w-0 space-y-3">
          <h4 className="text-sm font-semibold">Rostra profile</h4>
          {profile ? (
            <>
              <div className="flex items-start gap-3">
                {profile.imageUrl && <Portrait key={profile.imageUrl} src={profile.imageUrl} name={profile.name} />}
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">{profile.name}</p>
                  <p className="text-sm text-muted-foreground">{profile.party ?? "Party unavailable"}</p>
                </div>
              </div>
              {profile.officialUrl && <OfficialLink href={profile.officialUrl} label="Official website from Rostra" />}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              No confirmed Rostra profile is available. The Geocodio details are not a stored profile match.
            </p>
          )}
        </section>
      </div>
    </article>
  )
}

type OfficialLinkProps = Readonly<{ href: string; label: string }>

function OfficialLink({ href, label }: OfficialLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-block rounded-sm text-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
    >
      {label}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

type PortraitProps = Readonly<{ src: string; name: string }>

function Portrait({ src, name }: PortraitProps) {
  const [hasError, setHasError] = useState(false)
  if (hasError) {
    return null
  }
  return (
    <img
      src={src}
      alt={`Stored portrait of ${name}`}
      width={48}
      height={48}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className="size-12 shrink-0 rounded-md object-cover"
    />
  )
}
