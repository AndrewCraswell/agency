import { spawn } from "node:child_process"
import pg from "pg"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createBulkCopyEngine } from "./copy-engine.js"

const sourceEndpoint = process.env.LEGISLATION_BULK_TEST_SOURCE_URL
const targetEndpoint = process.env.LEGISLATION_BULK_TEST_TARGET_URL
const container = process.env.LEGISLATION_BULK_TEST_CONTAINER

describe.skipIf(!sourceEndpoint || !targetEndpoint || !container)("transactional PostgreSQL bulk copy", () => {
  const source = new pg.Client({ connectionString: sourceEndpoint })
  const target = new pg.Client({ connectionString: targetEndpoint })
  const dockerSpawn: Parameters<typeof createBulkCopyEngine>[0] = (command, arguments_, environment) =>
    spawn(
      "docker",
      [
        "exec",
        "-i",
        ...["PGAPPNAME", "PGDATABASE", "PGUSER", "PGPASSWORD", "PGSSLMODE", "PGOPTIONS"]
          .filter((key) => environment[key] !== undefined)
          .flatMap((key) => ["--env", `${key}=${environment[key]}`]),
        "--env",
        "PGHOST=127.0.0.1",
        "--env",
        "PGPORT=5432",
        container!,
        command,
        ...arguments_
      ],
      { stdio: ["pipe", "pipe", "pipe"], windowsHide: true }
    )
  const engine = createBulkCopyEngine(dockerSpawn)

  beforeAll(async () => {
    for (const [endpoint, name] of [
      [sourceEndpoint, "legislation_copy_source_test"],
      [targetEndpoint, "legislation_copy_target_test"]
    ]) {
      const url = new URL(endpoint!)
      if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== `/${name}`) {
        throw new Error("Bulk copy integration tests require named loopback-only disposable databases")
      }
    }
    await Promise.all([source.connect(), target.connect()])
    for (const client of [source, target]) {
      await client.query(`drop schema if exists legislation cascade; create schema legislation;
        create extension if not exists vector;
        create table legislation.bills(id int primary key, embedding vector(3));
        create index bills_embedding_idx on legislation.bills using hnsw (embedding vector_cosine_ops);
        comment on index legislation.bills_embedding_idx is 'Retain vector index metadata';
        create index bills_expression_idx on legislation.bills ((id+1));
        alter index legislation.bills_expression_idx alter column 1 set statistics 100;
        alter table legislation.bills cluster on bills_expression_idx;
        create table legislation.outbox(id int);
        create function legislation.capture() returns trigger language plpgsql as $$
          begin insert into legislation.outbox values (new.id); return new; end $$;
        create trigger capture after insert on legislation.bills for each row execute function legislation.capture();
        create trigger disabled_capture after insert on legislation.bills for each row execute function legislation.capture();
        alter table legislation.bills disable trigger disabled_capture`)
    }
    await source.query("insert into legislation.bills select n,'[1,2,3]' from generate_series(1,1000) n")
  }, 60_000)

  afterAll(async () => {
    await Promise.all([source.end(), target.end()])
  })

  async function copy(copyEngine = engine) {
    await source.query("begin isolation level repeatable read read only")
    try {
      const snapshot = await source.query<{ snapshot: string }>("select pg_export_snapshot() snapshot")
      return await copyEngine.copy({
        sourceEndpoint: sourceEndpoint!,
        targetEndpoint: targetEndpoint!,
        snapshot: snapshot.rows[0]!.snapshot,
        tables: ["bills"]
      })
    } finally {
      await source.query("rollback")
    }
  }

  async function schemaState() {
    const indexes = await target.query(
      "select indexname,indexdef from pg_indexes where schemaname='legislation' order by indexname"
    )
    const triggers = await target.query(
      "select tgname,tgenabled from pg_trigger where tgrelid='legislation.bills'::regclass order by tgname"
    )
    const metadata = await target.query(`select c.relname,obj_description(c.oid,'pg_class') description,
      i.indisclustered,a.attnum,a.attstattarget from pg_index i
      join pg_class c on c.oid=i.indexrelid join pg_attribute a on a.attrelid=c.oid
      where i.indrelid='legislation.bills'::regclass order by c.relname,a.attnum`)
    return { indexes: indexes.rows, triggers: triggers.rows, metadata: metadata.rows }
  }

  it("restores identical index definitions and trigger states, without firing the outbox", async () => {
    const before = await schemaState()
    expect((await copy()).counts).toEqual({ bills: "1000" })
    expect(await schemaState()).toEqual(before)
    expect((await target.query("select count(*)::int count from legislation.outbox")).rows[0]).toEqual({ count: 0 })
    expect((await target.query("select count(*)::int count from legislation.bills")).rows[0]).toEqual({ count: 1000 })
    expect(
      (
        await target.query(
          "select bool_and(indisvalid) valid from pg_index where indrelid='legislation.bills'::regclass"
        )
      ).rows[0]
    ).toEqual({ valid: true })
  }, 60_000)

  it("rolls back dropped indexes and disabled triggers when COPY fails", async () => {
    const before = await schemaState()
    await expect(copy()).rejects.toThrow("Bulk copy of legislation.bills failed")
    expect(await schemaState()).toEqual(before)
    expect((await target.query("select count(*)::int count from legislation.bills")).rows[0]).toEqual({ count: 1000 })
  }, 60_000)

  it("does not commit rows when rebuilding an index fails after COPY succeeds", async () => {
    await target.query("truncate legislation.bills")
    const before = await schemaState()
    const failingEngine = createBulkCopyEngine((command, arguments_, environment) =>
      dockerSpawn(
        command,
        arguments_.map((argument) =>
          argument.includes("execute item.definition")
            ? "do $$ begin raise exception 'forced index build failure'; end $$"
            : argument
        ),
        environment
      )
    )
    await expect(copy(failingEngine)).rejects.toThrow("Bulk copy of legislation.bills failed")
    expect(await schemaState()).toEqual(before)
    expect((await target.query("select count(*)::int count from legislation.bills")).rows[0]).toEqual({ count: 0 })
  }, 60_000)
})
