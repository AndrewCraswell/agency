# BP-123 reset and watchdog fragment

`bp-123-reset-watchdog-fragment.circuit.tsx` is a standalone, renderable
review fragment for the frozen `BP-123` reset/watchdog preflight contract. It
instantiates the selected `TPS389033DSER` supervisors, `TPS3431SDRBR`
watchdogs, `SN74LVC2G07DCKR` reset fanout, `BSS138AKA` reset sinks, and their
exact passive identities.

The fragment uses the canonical BP-123 preflight's ordered 11-net endpoint
list directly, rather than maintaining a second copy. Its test renders the
TSX, rejects component or port errors, confirms selected MPNs, proves every
canonical endpoint set is connected and remains mutually disjoint in the
rendered fragment, and locks the fixed review geometry plus ordered net
contract to a SHA-256 digest. The fragment validator rejects mutated or
aliased net data and any authority escalation.

It is not the canonical BP-300 schematic. It is not imported by any shared
board, and does not establish a BP-300 source, rendered PDF, ERC report,
integration approval, fabrication approval, or physical evidence.
