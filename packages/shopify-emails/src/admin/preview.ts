import { spawn } from "node:child_process"
import { access, rm } from "node:fs/promises"
import { relative, resolve } from "node:path"

/*
 * React Email's dev server, started with the pulled order in hand.
 *
 * A package script cannot set an environment variable the same way on every platform, and the dev
 * server has no flag to pass one, so the variable is set here and the server started underneath.
 * That also gives the run somewhere to say which values it is answering from, which the server's
 * own interface has no room for.
 */

/** Where `pull` writes by default, and the only file `reset` will remove. */
export const DEFAULT_VALUES = ".fixtures/order.json"

/** npm installs the dev server as a `.cmd` shim on Windows, which only resolves through a shell. */
const useShell = process.platform === "win32"

const exists = async (file: string): Promise<boolean> => {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

const missingServer = `React Email's dev server is not on PATH. Run this from the package that holds
the templates, where react-email is a dependency:

  cd packages/fc-templates
  pnpm dev`

type PreviewRun = {
  readonly dir: string
  readonly values: string
}

export const startPreview = async ({ dir, values }: PreviewRun): Promise<void> => {
  const file = resolve(values)
  const found = await exists(file)
  const where = relative(process.cwd(), file)
  process.stdout.write(
    found
      ? `Previewing against ${where}, laid over the samples. Only the templates built from an order take all of it.\n`
      : `No ${where} yet, so the samples answer. Run pull first to preview against your own store.\n`
  )

  const env = found ? { ...process.env, SHOPIFY_EMAILS_VALUES: file } : process.env
  const args = ["dev", "--dir", dir]

  /* Quoted rather than handed over as an array, which is what DEP0190 warns a shell cannot escape. */
  const child = useShell
    ? spawn(`email dev --dir "${dir}"`, { env, shell: true, stdio: "inherit" })
    : spawn("email", args, { env, stdio: "inherit" })

  await new Promise<void>((done, fail) => {
    child.on("error", () => {
      fail(new Error(missingServer))
    })
    child.on("close", (code) => {
      /* Ctrl-C closes with a signal and no code, which is how a reader is meant to stop this. */
      if (code === 0 || code === null) {
        done()
        return
      }
      fail(new Error(`The dev server exited with ${code}.`))
    })
  })
}

/*
 * Back to the shipped samples. A pulled order is one real order, and one order rarely carries a
 * discount, a gift card, a partial fulfilment and a second line at once; the samples were built to.
 */
export const resetValues = async (values: string): Promise<void> => {
  const file = resolve(values)
  const where = relative(process.cwd(), file)
  if (!(await exists(file))) {
    process.stdout.write(`No ${where} to remove. The samples already answer.\n`)
    return
  }
  await rm(file)
  process.stdout.write(`Removed ${where}. The samples answer again, and they cover more than one order can.\n`)
}
