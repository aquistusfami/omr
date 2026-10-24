#!/usr/bin/env node
/**
 * OMR hub: serves the built app to the phone over the LAN and stores every
 * graded sheet on this computer. No internet, no cloud, one folder.
 *
 *   cd web && npm run build && node tools/hub.mjs
 *
 * The phone opens the printed https URL once (with ?t=<token>); the token is
 * kept in the phone's localStorage and required on every write. Reads of the
 * data are not exposed over HTTP at all - the folder is the only copy.
 */
import { createServer as createHttps } from "node:https";
import { createServer as createHttp } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(HERE, "../dist");
const MAX_BODY = 3 * 1024 * 1024;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

function lanAddress() {
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) return net.address;
    }
  }
  return "127.0.0.1";
}

/** Bodies are tiny; anything bigger is a mistake or an attack. */
async function body(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function json(res, status, value) {
  const text = JSON.stringify(value);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(text);
}

/** Only jpeg thumbnails and a strict id shape reach the filesystem. */
function safeName(uid) {
  return /^[a-z0-9-]{8,64}$/i.test(uid) ? uid : null;
}

export async function startHub(options = {}) {
  const dir = path.resolve(options.dir ?? path.resolve(HERE, "../../data/omr"));
  const useTls = options.http !== true;
  const host = options.host ?? "0.0.0.0";
  const token =
    options.token ??
    (existsSync(path.join(dir, ".token"))
      ? (await readFile(path.join(dir, ".token"), "utf8")).trim()
      : randomBytes(6).toString("hex"));

  await mkdir(path.join(dir, "thumbs"), { recursive: true });
  await writeFile(path.join(dir, ".token"), token, { mode: 0o600 });

  // remember the token, so sheets already on the phone keep working across restarts
  const uidSeen = new Set();
  for (const line of (existsSync(path.join(dir, "sheets.jsonl"))
    ? (await readFile(path.join(dir, "sheets.jsonl"), "utf8")).split("\n")
    : [])) {
    try {
      uidSeen.add(JSON.parse(line).uid);
    } catch {
      /* a torn last line is ignored, it was never committed */
    }
  }

  const hits = new Map(); // ip -> { ok, fail, reset }
  const bucket = (ip) => {
    const now = Date.now();
    let b = hits.get(ip);
    if (!b || b.reset < now) b = { ok: 0, fail: 0, reset: now + 60_000 };
    hits.set(ip, b);
    return b;
  };

  async function handle(req, res) {
    const ip = req.socket.remoteAddress ?? "?";
    const url = new URL(req.url ?? "/", "http://hub");
    const route = url.pathname;

    if (route === "/api/health") {
      return json(res, 200, { ok: true, need: true, count: uidSeen.size });
    }

    if (route.startsWith("/api/")) {
      const b = bucket(ip);
      if (b.fail >= 5 || b.ok > 300) return json(res, 429, { error: "too many requests" });
      const auth = (req.headers.authorization ?? "").replace(/^Bearer /, "");
      const same =
        auth.length === token.length &&
        createHash("sha256").update(auth).digest("hex") === createHash("sha256").update(token).digest("hex");
      if (!same) {
        b.fail++;
        return json(res, 401, { error: "bad token" });
      }
      b.ok++;

      if (route === "/api/key" && req.method === "POST") {
        const payload = JSON.parse(await body(req));
        await writeFile(path.join(dir, "key.json"), JSON.stringify(payload, null, 2));
        return json(res, 200, { ok: true });
      }

      if (route === "/api/sheets" && req.method === "POST") {
        const payload = JSON.parse(await body(req));
        const uid = safeName(String(payload?.record?.uid ?? ""));
        const record = payload?.record;
        if (!uid || !record || typeof record !== "object") return json(res, 400, { error: "bad record" });
        if (uidSeen.has(uid)) return json(res, 200, { ok: true, duplicate: true });

        if (typeof payload.thumb === "string" && payload.thumb.length > 0) {
          const jpeg = Buffer.from(payload.thumb, "base64");
          if (jpeg.length > MAX_BODY) return json(res, 413, { error: "thumb too large" });
          await writeFile(path.join(dir, "thumbs", `${uid}.jpg`), jpeg);
        }
        // append last: a crash before this line means the phone will retry
        await appendFile(path.join(dir, "sheets.jsonl"), JSON.stringify(record) + "\n");
        uidSeen.add(uid);
        return json(res, 200, { ok: true });
      }

      return json(res, 404, { error: "not found" });
    }

    // ---- static app
    const rel = decodeURIComponent(route === "/" ? "/index.html" : route);
    const file = path.resolve(DIST, "." + rel);
    if (!file.startsWith(DIST + path.sep)) return json(res, 403, { error: "forbidden" });
    try {
      if (!(await stat(file)).isFile()) throw new Error("not a file");
    } catch {
      return json(res, 404, { error: "not found" });
    }
    const ext = path.extname(file);
    res.writeHead(200, {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
    });
    res.end(await readFile(file));
  }

  let server;
  if (useTls) {
    const certFile = path.join(dir, ".cert.json");
    if (!existsSync(certFile)) {
      const selfsigned = (await import("selfsigned")).default;
      const pems = await selfsigned.generate([{ name: "commonName", value: "omr.local" }], {
        days: 825,
        keySize: 2048,
      });
      await writeFile(certFile, JSON.stringify({ cert: pems.cert, key: pems.private }), { mode: 0o600 });
    }
    const pems = JSON.parse(await readFile(certFile, "utf8"));
    server = createHttps({ cert: pems.cert, key: pems.key }, (req, res) => void handle(req, res).catch(fail(res)));
  } else {
    server = createHttp({}, (req, res) => void handle(req, res).catch(fail(res)));
  }

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port ?? 0, host, () => resolve());
  });

  const port = server.address().port;
  return {
    url: `${useTls ? "https" : "http"}://${host === "0.0.0.0" ? lanAddress() : host}:${port}/`,
    token,
    dir,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

function fail(res) {
  return (error) => {
    const status = error?.status ?? 500;
    if (!res.headersSent) json(res, status, { error: error?.message ?? "server error" });
    else res.end();
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : fallback;
  };
  const hub = await startHub({
    port: Number(arg("port", 8443)),
    dir: arg("dir", undefined),
    http: process.argv.includes("--http"),
  });
  console.log(`\n  OMR hub đang chạy\n`);
  console.log(`  Mở trên điện thoại:  ${hub.url}?t=${hub.token}`);
  console.log(`  Dữ liệu lưu tại:     ${hub.dir}`);
  console.log(`\n  Ctrl+C để dừng. Đừng chia sẻ link này ra ngoài lớp.\n`);
}
