import templateJson from "../../fixtures/template.json";
import { findAnchors } from "./anchors";
import { cameraSupported, grabFrame, startCamera, stopCamera, toThumbnail } from "./capture";
import { download, tableData, toCsv, toJson } from "./export";
import { gradeSheet, type GradeResult } from "./grade";
import { fromRgba } from "./image";
import { DEFAULT_KEY, parseKeys, score, type KeyConfig } from "./key";
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
const hintText = $<HTMLSpanElement>("hint-text");
const hintMarks = $<HTMLSpanElement>("hint-marks");
const lastEl = $<HTMLParagraphElement>("last");
const statusEl = $<HTMLParagraphElement>("status");
const listEl = $<HTMLElement>("list");
const countEl = $<HTMLElement>("count");
const themeBtn = $<HTMLButtonElement>("theme");

const keyPanel = $<HTMLDetailsElement>("key-panel");
const keyText = $<HTMLTextAreaElement>("key-text");
const p1Weight = $<HTMLInputElement>("p1-weight");
const p2Weight = $<HTMLInputElement>("p2-weight");
const p2Mode = $<HTMLSelectElement>("p2-mode");
const keyStatus = $<HTMLParagraphElement>("key-status");

let scanner = new Scanner();
let stream: MediaStream | null = null;
let running = false;
let busy = false;
let generation = 0;
let audio: AudioContext | null = null;
let lastError = "";

$("template-name").textContent = `${tmpl.name} · ${tmpl.blocks ? Object.keys(tmpl.blocks).length : 0} khối ô`;

/* ------------------------------------------------------------- answer key */

const KEY_STORAGE = "omr:key:v1";

function loadKeyConfig(): KeyConfig {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY_STORAGE) ?? "null") as Partial<KeyConfig> | null;
    if (!saved) return { ...DEFAULT_KEY };
    return {
      text: typeof saved.text === "string" ? saved.text : "",
      p1: Number.isFinite(saved.p1) ? Number(saved.p1) : DEFAULT_KEY.p1,
      p2: Number.isFinite(saved.p2) ? Number(saved.p2) : DEFAULT_KEY.p2,
      mode: saved.mode === "all" ? "all" : "split",
    };
  } catch {
    return { ...DEFAULT_KEY };
  }
}

let keyCfg = loadKeyConfig();
let keys = parseKeys(keyCfg.text).keys;

function saveKeyConfig(): void {
  try {
    localStorage.setItem(KEY_STORAGE, JSON.stringify(keyCfg));
  } catch {
    /* private mode: the key still works for this session */
  }
}

function showKeyStatus(): void {
  const { errors } = parseKeys(keyCfg.text);
  const codes = Object.keys(keys).length;
  keyStatus.textContent = errors.length
    ? errors.slice(0, 3).join(" · ")
    : codes
      ? `${codes} mã đề · ${keyCfg.p1}đ/câu I · ${keyCfg.p2}đ/câu II (${
          keyCfg.mode === "all" ? "đúng cả 6 ý" : "chia đều 6 ý"
        })`
      : "Chưa có đáp án — phiếu vẫn được đọc, chỉ chưa có điểm.";
}

function applyKeyConfig(): void {
  keys = parseKeys(keyCfg.text).keys;
  saveKeyConfig();
  showKeyStatus();
}

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

function unlockAudio(): void {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch {
    /* no audio is acceptable; the banner still shows the state */
  }
}

function beep(ok: boolean): void {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
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

// The banner is an aria-live region: rewriting the same text every frame makes
// a screen reader repeat it, and repaints for nothing.
let bannerKey = "";

function setBanner(kind: "wait" | "ok" | "bad", text: string, detail?: string): void {
  const key = `${kind}|${text}|${detail ?? "\u0000"}`;
  if (key === bannerKey) return;
  bannerKey = key;
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

// Aiming aid inside the viewfinder. It answers "is the phone actually seeing
// the sheet, and what should I change?" without the user reading the banner.
let hintKey = "";

function setHint(text: string, marks?: number): void {
  const key = `${text}|${marks ?? "-"}`;
  if (key === hintKey) return;
  hintKey = key;
  hintText.textContent = text;
  hintMarks.textContent = marks === undefined ? "" : `${marks}/${tmpl.anchors.length}`;
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
    p2: Object.fromEntries(
      Object.entries(r.p2).map(([q, u]) => [q, u.values.map((v) => v || "?").join("")]),
    ),
    flags: r.flags,
    anchors: r.anchors,
  };
}

async function save(result: GradeResult): Promise<store.SheetRecord> {
  const thumb = result.canvas ? await toThumbnail(result.canvas) : null;
  return store.add(toRecord(result), thumb);
}

/* -------------------------------------------------------------------- loop */

const FRAME_GAP = 300;

async function scanOnce(): Promise<void> {
  // After an accept the sheet is still on the stand: stop spending a full
  // grading pass on it, just watch for it leaving the frame.
  if (scanner.phase === "cooldown") {
    const marksSeen = !!findAnchors(grabFrame(video, 900), tmpl);
    if (scanner.cleared(marksSeen)) {
      setBanner("wait", "Đưa phiếu tiếp theo vào khung", "");
      setHint("Chưa thấy phiếu", 0);
    }
    return;
  }

  const result = gradeSheet(grabFrame(video), tmpl, {
    // only the frame that may be accepted needs the rectified image for a thumbnail
    keepCanvas: scanner.phase === "settle",
  });
  const action = scanner.push({
    at: performance.now(),
    result,
    marksSeen: result.marks >= 6,
  });

  if (action.type === "accept") {
    const saved = await save(action.result);
    beep(true);
    setBanner("ok", "Đã nhận — nhấc phiếu ra", details(saved));
    setHint("Nhấc phiếu ra");
    await render();
  } else if (action.type === "reject") {
    beep(false);
    setBanner(
      "bad",
      action.reason === "quality" ? "Mờ hoặc lệch — đặt lại" : "Thiếu dấu góc — đặt lại",
    );
    setHint("Nhấc ra, đặt lại");
  } else {
    setBanner("wait", scanner.phase === "settle" ? "Đang đọc…" : "Đưa phiếu vào khung");
    const marks = result.marks;
    setHint(
      marks >= 6 ? "Đã thấy phiếu — giữ yên" : marks > 0 ? "Đưa phiếu vào sâu hơn" : "Chưa thấy phiếu",
      marks,
    );
  }
}

async function tick(): Promise<void> {
  if (!running) return;
  const mine = generation;
  const started = performance.now();
  if (!busy && video.readyState >= 2 && video.videoWidth) {
    busy = true;
    try {
      await scanOnce();
      lastError = "";
    } catch (error) {
      // One unreadable frame, a full disk or a locked database must never stop
      // the camera: report it, then keep scanning.
      const message = (error as Error)?.message || String(error);
      if (message !== lastError) {
        lastError = message;
        beep(false);
        setBanner("bad", "Lỗi khi chấm phiếu", message);
      }
    } finally {
      busy = false;
    }
  }
  if (mine !== generation) return;
  setTimeout(() => void tick(), Math.max(80, FRAME_GAP - (performance.now() - started)));
}

async function startAuto(): Promise<void> {
  if (running) return;
  if (!cameraSupported()) {
    setBanner(
      "bad",
      "Không mở được camera",
      location.protocol === "https:"
        ? "Hãy cho phép quyền camera cho trang này rồi thử lại"
        : "Trang phải chạy bằng https — hoặc dùng Chụp thủ công",
    );
    return;
  }
  try {
    stream = await startCamera(video);
  } catch (error) {
    setBanner("bad", "Không mở được camera", (error as Error).message);
    return;
  }
  // a scanner left in cooldown from the previous run would ignore the first
  // sheet until it saw two empty frames
  scanner = new Scanner();
  stage.hidden = false;
  picker.hidden = true;
  stage.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
  running = true;
  generation++;
  $("auto").setAttribute("aria-pressed", "true");
  $("manual").setAttribute("aria-pressed", "false");
  setBanner("wait", "Đưa phiếu vào khung", "");
  setHint("Chưa thấy phiếu", 0);
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
  try {
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
  } catch (error) {
    beep(false);
    setBanner("bad", "Không đọc được ảnh", (error as Error)?.message || String(error));
  }
}

/* ------------------------------------------------------------------- list */

async function render(): Promise<void> {
  const rows = await store.all();
  const recentRows = rows.slice(-20).reverse();
  const bad = rows.filter((r) => !r.ok).length;
  const flagged = rows.filter((r) => r.ok && r.flags.length).length;
  const dup = rows.filter((r) => r.duplicate).length;
  const hasKey = Object.keys(keys).length > 0;
  const scored = rows.map((r) => score(r, keys, keyCfg)).filter((s) => s !== null);
  const average = scored.length ? scored.reduce((a, s) => a + s.total, 0) / scored.length : 0;

  statusEl.textContent =
    `${rows.length} phiếu · ${flagged} có ô cần xem · ${bad} bị từ chối` +
    (dup ? ` · ${dup} trùng mã SV` : "") +
    (scored.length
      ? ` · điểm TB ${average.toFixed(2)}/${(10 * keyCfg.p1 + 5 * keyCfg.p2).toFixed(0)}`
      : "") +
    (hasKey && scored.length < rows.length
      ? ` · ${rows.length - scored.length} chưa có đáp án/điểm`
      : "");

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
      const s = score(r, keys, keyCfg);
      row.innerHTML = `
        <div class="row-head">
          <strong>${r.studentId || "?"}</strong>
          <span class="muted">đề ${r.examCode || "?"}</span>
          ${r.duplicate ? `<span class="dup">trùng</span>` : ""}
          <time class="muted">${new Date(r.at).toLocaleTimeString("vi-VN")}</time>
        </div>
        ${hasKey ? `<span class="score">${s ? s.total.toFixed(2) : "—"}</span>` : ""}
        <div class="answers">${
          r.ok
            ? [...Object.entries(r.p1).map(([q, v]) => `${q}${v || "·"}`),
               ...Object.entries(r.p2).map(([q, v]) => `${q}:${[...v].map((c) => (c === "?" ? "·" : c)).join("")}`)].join("  ")
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
  const scoring = { keys, cfg: keyCfg };
  const table = tableData(rows, tmpl, scoring);
  if (kind === "csv") download(`ket-qua-${stamp()}.csv`, toCsv(table));
  if (kind === "json") download(`ket-qua-${stamp()}.json`, toJson(rows, tmpl, scoring));
  if (kind === "xlsx") download(`ket-qua-${stamp()}.xlsx`, toXlsx(table.head, table.body));
}

/* ------------------------------------------------------------------ wires */

keyText.value = keyCfg.text;
p1Weight.value = String(keyCfg.p1);
p2Weight.value = String(keyCfg.p2);
p2Mode.value = keyCfg.mode;
showKeyStatus();
// an empty key is the first thing to fill in, so open the panel for it
keyPanel.open = !Object.keys(keys).length;

let keyTimer = 0;
function keyChanged(): void {
  keyCfg = {
    text: keyText.value,
    p1: Number(p1Weight.value) || 0,
    p2: Number(p2Weight.value) || 0,
    mode: p2Mode.value === "all" ? "all" : "split",
  };
  applyKeyConfig();
  clearTimeout(keyTimer);
  keyTimer = window.setTimeout(() => void render(), 300);
}

keyText.addEventListener("input", keyChanged);
p1Weight.addEventListener("input", keyChanged);
p2Weight.addEventListener("input", keyChanged);
p2Mode.addEventListener("change", keyChanged);

$("auto").addEventListener("click", () => {
  unlockAudio();
  void startAuto();
});
$("manual").addEventListener("click", () => {
  unlockAudio();
  stopAuto();
  $("manual").setAttribute("aria-pressed", "true");
  stage.hidden = true;
  picker.hidden = false;
  setBanner("wait", "Chọn ảnh phiếu để chấm", "");
});
fileInput.addEventListener("change", () => {
  unlockAudio();
  const file = fileInput.files?.[0];
  fileInput.value = "";
  if (file) void handleFile(file);
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
