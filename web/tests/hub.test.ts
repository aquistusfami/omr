import { existsSync, readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startHub } from "../tools/hub.mjs";

let hub: Awaited<ReturnType<typeof startHub>>;
let base = "";

const record = (uid: string, studentId = "202511756") => ({
  uid,
  at: 1760000000000,
  ok: true,
  studentId,
  examCode: "511",
  p1: { "1": "A" },
  p2: { "11": "DSDSSS" },
  flags: [],
  anchors: { used: 21, residual: 0.8 },
});

const post = (route: string, body: unknown, token = "test-token-123") =>
  fetch(base + route, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "omr-hub-"));
  hub = await startHub({ http: true, host: "127.0.0.1", port: 0, dir, token: "test-token-123" });
  base = hub.url.replace(/\/$/, "");
});

afterAll(async () => {
  await hub?.close();
});

describe("hub", () => {
  it("answers health without a token", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, need: true });
  });

  it("refuses writes without the token", async () => {
    const res = await post("/api/sheets", { record: record("a".repeat(8)) }, "");
    expect(res.status).toBe(401);
  });

  it("refuses writes with a wrong token", async () => {
    const res = await post("/api/sheets", { record: record("b".repeat(8)) }, "wrong-token-123");
    expect(res.status).toBe(401);
  });

  it("stores a sheet and its thumbnail once", async () => {
    const uid = "11111111-2222-3333-4444-555555555555";
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
    const first = await post("/api/sheets", { record: record(uid), thumb: jpeg });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true });

    const again = await post("/api/sheets", { record: record(uid), thumb: jpeg });
    expect(await again.json()).toMatchObject({ duplicate: true });

    const lines = readFileSync(path.join(hub.dir, "sheets.jsonl"), "utf8").trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]).studentId).toBe("202511756");
    expect(existsSync(path.join(hub.dir, "thumbs", `${uid}.jpg`))).toBe(true);
  });

  it("keeps the answer key in the data folder", async () => {
    const res = await post("/api/key", { cfg: { p1: 2, p2: 2, mode: "all" }, keys: {} });
    expect(res.status).toBe(200);
    expect(JSON.parse(readFileSync(path.join(hub.dir, "key.json"), "utf8")).cfg.p1).toBe(2);
  });

  it("rejects a malformed uid instead of touching the filesystem", async () => {
    const res = await post("/api/sheets", { record: record("../../etc/passwd") });
    expect(res.status).toBe(400);
  });

  it("never serves files outside dist", async () => {
    const res = await fetch(`${base}/../package.json`);
    expect([403, 404]).toContain(res.status);
  });
});
