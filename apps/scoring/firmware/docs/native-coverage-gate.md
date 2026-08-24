# Native C/C++ coverage gate

`tools/check-coverage.mjs` is the required LLVM source-based coverage gate for
all first-party C and C++ under `apps/scoring/firmware`.

Run it from `apps/scoring`:

```powershell
node firmware/tools/check-coverage.mjs
```

The gate configures each native host-test CMake project with
`SCORING_ENABLE_LLVM_COVERAGE=ON`, runs CTest, merges the generated profiles
with `llvm-profdata`, and reads line, function, and branch measurements from
`llvm-cov export`. It fails when a required tool, profile, executable, source
mapping, or metric is absent; it does not silently omit branch coverage.

The explicit core-source allowlist is `CORE_SOURCES` in
`tools/check-coverage.mjs`. It currently contains only
`stm32/core/stm32_scoring_core.c`. Every line, function, and branch in that
file must be covered at 100 percent. Every other first-party `.c`, `.cc`,
`.cpp`, or `.cxx` below `firmware/` must meet 80 percent for all three metrics.

Only generated, vendor, cache, build-output, and test directories are excluded:
`generated/`, `vendor/`, `.cache/`, `out/`, and `tests/`. Target adapters are
first-party source and are therefore required by the gate. If a target adapter
has no native host seam, the gate fails with a missing coverage mapping until a
host test seam is added; it must not be excluded.

On Windows the script discovers the pinned LLVM-MinGW installation used by the
native host tests. Set `SCORING_LLVM_BIN` to its `bin` directory to override
discovery. CI needs Clang, `llvm-profdata`, `llvm-cov`, CMake, and Ninja.
