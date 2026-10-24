/**
 * Sending sheets to the hub on the computer. The app works stand-alone; this is
 * a best-effort mirror, and IndexedDB stays the source of truth until the hub
 * acknowledges each row (then `sent` is set and it is never resent).
 */
import type { SheetRecord } from "./store";

const TOKEN_KEY = "omr:hub:v1";

export type HubState = { active: boolean; connected: boolean; error?: string };

let token = "";
let active = false;
let connected = false;

/** The hub prints a link with ?t=…; keep it so the teacher types nothing twice. */
export function readTokenFromUrl(): void {
  const fromUrl = new URL(location.href).searchParams.get("t");
  if (fromUrl) {
    token = fromUrl;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* private mode: the token still works for this page load */
    }
    history.replaceState(null, "", location.pathname + location.hash);
    return;
  }
  try {
    token = localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    token = "";
  }
}

export function setToken(value: string): void {
  token = value.trim();
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
}

export function hasToken(): boolean {
  return token.length > 0;
}

/** Called once at boot: is this page served by a hub, and does it accept us? */
export async function probe(): Promise<HubState> {
  readTokenFromUrl();
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) {
      active = false;
      return { active: false, connected: false };
    }
    const info = (await res.json()) as { ok?: boolean; need?: boolean };
    active = info.ok === true;
    connected = active && (!info.need || hasToken());
    return { active, connected };
  } catch {
    active = false;
    return { active: false, connected: false };
  }
}

async function post(path: string, payload: unknown): Promise<boolean> {
  if (!active || !token) return false;
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  connected = res.ok;
  return res.ok;
}

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

export async function pushSheet(record: SheetRecord, thumb: Blob | null): Promise<boolean> {
  return post("/api/sheets", { record, thumb: thumb ? await toBase64(thumb) : null });
}

export async function pushKey(payload: unknown): Promise<boolean> {
  return post("/api/key", payload);
}

export function state(): HubState {
  return { active, connected };
}
