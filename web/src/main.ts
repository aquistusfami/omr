import templateJson from "../../fixtures/template.json";
import { cameraSupported, grabFrame, startCamera, stopCamera, toThumbnail } from "./capture";
import { download, tableData, toCsv, toJson } from "./export";
import { gradeSheet, type GradeResult } from "./grade";
import { fromRgba } from "./image";
import { Scanner } from "./scan";
import * as store from "./store";
import type { Template } from "./types";
import { toXlsx } from "./xlsx";

const tmpl = templateJson as unknown as Template;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const video = $<HTMLVideoElement>("video");
const stage = $<HTMLElement>("stage");
const picker = $<HTMLElement>("picker");
const fileInput = $<HTMLInputElement>("file");
const banner = $<HTMLParagraphElement>("banner");
const lastEl = $<HTMLParagraphElement>("last");
const statusEl = $<HTMLParagraphElement>("status");
const listEl = $<HTMLElement>("list");
const countEl = $<HTMLElement>("count");
const themeBtn = $<HTMLButtonElement>("theme");

const scanner = new Scanner();
let stream: MediaStream | null = null;
let running = false;
let busy = false;
let generation = 0;
let lastAcceptAt = 0;
let audio: AudioContext | null = null;

$("template-name").textContent = `${tmpl.name} · ${tmpl.blocks ? Object.keys(tmpl.blocks).length : 0} khối ô`;

/* ------------------------------------------------------------------- theme */

const THEME_COLOR = { light: "#eef1ec", dark: "#0e1310" };

function applyTheme(theme: "light" | "dark"): void {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
  themeBtn.setAttribute("aria-label", theme === "dark" ? "Đổi sang nền sáng" : "Đổi sang nền tối");
}

applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("omr:theme", next);
  applyTheme(next);
});

/* ---------------------------------------------------------------- feedback */

function beep(ok: boolean): void {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = ok ? 880 : 300;
    gain.gain.setValueAtTime(0.08, audio.currentTime);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + (ok ? 0.12 : 0.3));
  } catch {
    /* audio is a nicety; never block grading on it */
  }
  navigator.vibrate?.(ok ? 60 : [60, 80, 60]);
}

function setBanner(kind: "wait" | "ok" | "bad", text: string, detail?: string): void {
  banner.textContent = text;
  if (detail !== undefined) lastEl.textContent = detail;
  document.body.dataset.state = kind;
}

function details(saved: store.SheetRecord): string {
  return (
    `${saved.studentId} · đề ${saved.examCode}` +
    (saved.flags.length ? ` · ${saved.flags.length} ô cần xem` : "") +
    (saved.duplicate ? " · trùng mã SV" : "")
  );
}

/* ------------------------------------------------------------------ record */

function toRecord(r: GradeResult) {
  return {
    at: Date.now(),
    ok: r.ok,
    reason: r.reason,
    studentId: r.studentId,
    examCode: r.examCode,
    p1: Object.fromEntries(Object.entries(r.p1).map(([q, u]) => [q, u.value])),
    p2: Object.fromEntries(Object.entries(r.p2).map(([q, u]) => [q, u.values.join("")])),
    flags: r.flags,
    anchors: r.anchors,
  };
}

async function save(result: GradeResult): Promise<store.SheetRecord> {
  const thumb = result.canvas ? await toThumbnail(result.canvas) : null;
  return store.add(toRecord(result), thumb);
}

/* -------------------------------------------------------------------- loop */

async function tick(): Promise<void> {
  if (!running) return;
  const mine = generation;
  if (!busy && video.readyState >= 2 && video.videoWidth) {
    busy = true;
    try {
      const result = gradeSheet(grabFrame(video), tmpl, { keepCanvas: true });
      const action = scanner.push({
        at: performance.now(),
        result,
        marksSeen: result.anchors.used > 0,
      });

      if (action.type === "accept") {
        lastAcceptAt = performance.now();
        const saved = await save(action.result);
        beep(true);
        setBanner("ok", "Đã nhận — nhấc phiếu ra", details(saved));
        await render();
      } else if (action.type === "reject") {
        beep(false);
        setBanner(
          "bad",
          action.reason === "quality" ? "Mờ hoặc lệch — đặt lại" : "Thiếu dấu góc — đặt lại",
        );
      } else {
        const phase = scanner.phase;
        // keep the accepted-sheet details on screen for a moment
        const stillShowing = performance.now() - lastAcceptAt < 2500;
        if (phase !== "cooldown" || !stillShowing) {
          setBanner(
            phase === "cooldown" ? "ok" : "wait",
            phase === "cooldown" ? "Đã nhận — nhấc phiếu ra" : phase === "settle" ? "Đang đọc…" : "Đưa phiếu vào khung",
          );
        }
      }
    } finally {
      busy = false;
    }
  }
  if (mine !== generation) return;
  setTimeout(() => void tick(), 220);
}

async function startAuto(): Promise<void> {
  if (running) return;
  if (!cameraSupported()) {
    statusEl.textContent =
      "Trình duyệt không cho mở camera. Cần https (hoặc localhost) và quyền camera — dùng \"Chụp thủ công\" nếu không xử lý được.";
    return;
  }
  try {
    stream = await startCamera(video);
  } catch (error) {
    statusEl.textContent = `Không mở được camera: ${(error as Error).message}`;
    return;
  }
  stage.hidden = false;
  picker.hidden = true;
  stage.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
  running = true;
  generation++;
  $("auto").setAttribute("aria-pressed", "true");
  $("manual").setAttribute("aria-pressed", "false");
  setBanner("wait", "Đưa phiếu vào khung", "");
  void tick();
}

function stopAuto(): void {
  running = false;
  generation++;
  stopCamera(stream);
  stream = null;
  stage.hidden = true;
  $("auto").setAttribute("aria-pressed", "false");
}

/* ------------------------------------------------------------ manual input */

async function handleFile(file: File): Promise<void> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const result = gradeSheet(fromRgba(ctx.getImageData(0, 0, w, h).data, w, h), tmpl, {
    keepCanvas: true,
  });
  const saved = await save(result);
  beep(result.ok);
  if (result.ok) setBanner("ok", "Đã nhận — nhấc phiếu ra", details(saved));
  else setBanner("bad", "Không đọc được phiếu", `lý do: ${result.reason}`);
  await render();
}

/* ------------------------------------------------------------------- list */

async function render(): Promise<void> {
  const rows = await store.all();
  const recentRows = rows.slice(-20).reverse();
  const bad = rows.filter((r) => !r.ok).length;
  const flagged = rows.filter((r) => r.ok && r.flags.length).length;
  const dup = rows.filter((r) => r.duplicate).length;

  statusEl.textContent =
    `${rows.length} phiếu · ${flagged} có ô cần xem · ${bad} bị từ chối` +
    (dup ? ` · ${dup} trùng mã SV` : "");

  const total = String(rows.length);
  if (countEl.textContent !== total) {
    countEl.textContent = total;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      countEl.animate(
        [
          { transform: "translateY(-0.35em)", opacity: 0 },
          { transform: "none", opacity: 1 },
        ],
        { duration: 220, easing: "cubic-bezier(0.16,1,0.3,1)" },
      );
    }
  }

  listEl.replaceChildren(
    ...recentRows.map((r) => {
      const row = document.createElement("article");
      row.className = "row" + (r.ok ? "" : " rejected");
      row.innerHTML = `
        <div class="row-head">
          <strong>${r.studentId || "?"}</strong>
          <span class="muted">đề ${r.examCode || "?"}</span>
          ${r.duplicate ? `<span class="dup">trùng</span>` : ""}
          <time class="muted">${new Date(r.at).toLocaleTimeString("vi-VN")}</time>
        </div>
        <div class="answers">${
          r.ok
            ? [...Object.entries(r.p1).map(([q, v]) => `${q}${v || "·"}`),
               ...Object.entries(r.p2).map(([q, v]) => `${q}:${[...v].map((c) => c || "·").join("")}`)].join("  ")
            : "Chụp lại phiếu này"
        }</div>
        ${r.ok && r.flags.length ? `<div class="flags">cần xem: ${r.flags.join(", ")}</div>` : ""}
        ${r.id ? `<button class="ghost remove" data-id="${r.id}">xoá</button>` : ""}`;
      row.querySelector(".remove")?.addEventListener("click", async (e) => {
        const id = Number((e.currentTarget as HTMLElement).dataset.id);
        await store.remove(id);
        await render();
      });
      return row;
    }),
  );
}

/* ---------------------------------------------------------------- exports */

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

async function exportAs(kind: "csv" | "xlsx" | "json"): Promise<void> {
  const rows = await store.all();
  if (!rows.length) {
    statusEl.textContent = "Chưa có phiếu nào để xuất.";
    return;
  }
  const table = tableData(rows, tmpl);
  if (kind === "csv") download(`ket-qua-${stamp()}.csv`, toCsv(table));
  if (kind === "json") download(`ket-qua-${stamp()}.json`, toJson(rows, tmpl));
  if (kind === "xlsx") download(`ket-qua-${stamp()}.xlsx`, toXlsx(table.head, table.body));
}

/* ------------------------------------------------------------------ wires */

$("auto").addEventListener("click", () => void startAuto());
$("manual").addEventListener("click", () => {
  stopAuto();
  $("manual").setAttribute("aria-pressed", "true");
  stage.hidden = true;
  picker.hidden = false;
  setBanner("wait", "Chọn ảnh phiếu để chấm", "");
});
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (file) void handleFile(file).catch((e) => (statusEl.textContent = `Lỗi: ${e.message}`));
});
$("csv").addEventListener("click", () => void exportAs("csv"));
$("xlsx").addEventListener("click", () => void exportAs("xlsx"));
$("json").addEventListener("click", () => void exportAs("json"));
$("clear").addEventListener("click", async () => {
  if (!confirm("Xoá toàn bộ kết quả đã chấm?")) return;
  await store.clear();
  await render();
});

document.addEventListener("visibilitychange", () => {
  // a hidden tab throttles the loop; stop the camera instead of half-running
  if (document.hidden && running) {
    stopAuto();
    setBanner("wait", "Camera đã dừng khi rời tab");
  }
});

void render();
