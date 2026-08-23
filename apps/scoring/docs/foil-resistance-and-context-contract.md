# Foil resistance and logical-context evidence contract

**Status:** host-only classification evidence; composite FOIL-02, FOIL-03, and
FOIL-04 rows remain planned

## Scope

[`foil-evidence.ts`](../src/foil-evidence.ts) classifies trusted resistance
intervals and already-derived logical contact contexts. It does not measure a
resistance, detect a surface, qualify a circuit break, select a physical lamp,
or prove apparatus behavior. The existing foil scorer remains the only owner
of contact qualification.

The classifications close small software portions of FOIL-02 through FOIL-04:

- standard-foil indication requirements at 0 Ω and 200 Ω, the permitted region
  strictly between 200 Ω and 500 Ω, and the absence of a published
  classification at and above 500 Ω;
- the closed foil circuit's no-non-valid guarantee through 200 Ω;
- guard or piste suppression through a 100 Ω trusted earth path;
- logical handling of a conductive jacket touch without a tip break, blade
  contact, and an own weapon-to-jacket insulation short; and
- anti-blocking independence from an own insulation short.

These are normative or product-policy classifications over trusted host
inputs. Physical conductor acquisition, uncertainty budgets, analogue
thresholds, lamps, and complete-apparatus correlation remain open.

## Standard exterior resistance

`classifyFoilExteriorResistance` returns permitted indication vocabulary. It
does not emit an indication.

| Trusted interval | Host result |
| --- | --- |
| Entirely at or below 200,000 milli-ohms | `required-indication` with `valid` |
| Entirely above 200,000 and below 500,000 milli-ohms | `permitted-indications` with valid, valid-and-non-valid, or non-valid |
| Entirely at or above 500,000 milli-ohms | `outside-published-range` |
| Crosses either boundary | `indeterminate` |
| No trusted measurement | `unavailable` |

Exact 500 Ω is outside the classified valid/non-valid region because FOIL-02
states those cases with resistance below 500 Ω. This is not a claim that a
physical apparatus must suppress a signal at 500 Ω.

## Closed circuit and earth path

`classifyFoilClosedCircuitResistance` returns
`must-not-produce-non-valid` only when the entire trusted interval is at or
below 200 Ω. `classifyFoilEarthContactResistance` returns `must-not-signal`
only when the entire trusted interval is at or below 100 Ω. Intervals crossing
the respective endpoint are `indeterminate`; intervals wholly above it are
`outside-published-range` rather than silently normalized.

## Logical contexts and apparatus mode

`classifyFoilLogicalContext` consumes a trusted context; it does not infer one.

| Context | Standard mode | Anti-blocking mode |
| --- | --- | --- |
| Guard or piste | `must-not-signal` | `must-not-signal` |
| Conductive jacket without a tip break | `must-not-signal` | `must-not-signal` |
| Blade contact | `normal-contact-rules-apply` | `not-specified` |
| Own weapon-to-jacket insulation short | `not-specified` | `does-not-block-contact-scorer` |

The anti-blocking blade-contact result is `not-specified` because FOIL-04
explicitly excludes that FOIL-03 point. The own-short result only says the
short does not block the existing contact scorer; it does not create a hit.

## Evidence status

- FOIL-02 remains planned: host boundary classification and timing tests exist,
  but calibrated resistance acquisition and combined time/resistance apparatus
  evidence do not.
- FOIL-03 remains planned: host closed-circuit, earth-path, and logical-context
  decisions exist, but the seven-conductor mapping, resistance measurement,
  blade-contact acquisition, and physical no-signal proof do not.
- FOIL-04 remains planned: host anti-blocking eligibility and yellow diagnostic
  outputs cover 0 Ω, 200 Ω, 500 Ω, below 450 Ω, the unresolved 450–475 Ω band,
  and above 475 Ω. Lamp persistence, referee-facing output, analogue
  thresholds, and complete-apparatus correlation remain open.
