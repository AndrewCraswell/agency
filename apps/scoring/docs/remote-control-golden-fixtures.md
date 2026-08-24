# RC-02 remote-control golden fixtures

The RC-02 acceptance set is frozen in
[`src/remote-control-golden-fixtures.ts`](../src/remote-control-golden-fixtures.ts). Its fixture identifier is
`rc-02-golden-1.0.0`, and every value is recursively frozen at module load.

The command map contains one handwritten, complete `RemoteCommand` for each of the 32 canonical command keys. It
also includes complete fresh, loaded, overtime, new-bout, and authority-transfer snapshots. Applied events cover a
score, snapshot load, new-bout STM32 reset completion, and authority transfer. A rejected event records the
wrong-controller-authority outcome with no resulting state.

The companion test imports the public RC-02 guards and parsers. It checks JSON round-trips against the checked-in
values, rather than generating expected values from those parsers. The command-key sequence is independently checked
for exact order, cardinality, uniqueness, and map-key identity; missing, extra, duplicate, and reordered fixtures fail.
The canonical command identity is bounded to safe counters and 64-character identifiers and pinned by the checked-in
SHA-256 digest `sha256:a50a8bec2817a085b4ea281e287a1e04422a304633c04c60b9e3c46f3ac42f2f`. The adversarial cases
intentionally exercise empty and invalid state, extra and missing fields, non-enumerable and symbol drift, accessor
properties, renamed aliases, schema-version drift, wrong discriminants, invalid payloads, event provenance mismatches,
and handheld attempts to use application-only commands.

Changing a command field, snapshot field, event correlation, or fixture version requires an intentional golden-fixture
revision. A parser or reducer must not be called while constructing these values: otherwise a regression could update
the implementation and its oracle together.
