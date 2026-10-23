import templateJson from "../../fixtures/template.json";
import { download, toCsv } from "./export";
import { gradeSheet } from "./grade";
import { fromRgba, type Gray } from "./image";
import * as store from "./store";
import type { Template } from "./types";

const tmpl = templateJson as unknown as Template;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const fileInput = $<HTMLInputElement>("file");
const statusEl = $<HTMLParagraphElement>("status");
const listEl = $<HTMLElement>("list");

$("template-name").textContent = `${tmpl.name} · ${tmpl.sections.length} phần · ${Object.keys(tmpl.blocks).length} khối ô`;

/** Decode, downscale once and hand back grayscale. 1800 px is plenty for a 4 mm bubble. */
async function toGray(file: File): Promise<Gray> {
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
  const { data } = ctx.getImageData(0, 0, w, h);
  return fromRgba(data, w, h);
}

function summary(r: store.SheetRecord): string {
  const byNumber = (a: [string, unknown], b: [string, unknown]) => Number(a[0]) - Number(b[0]);
  const answers = [
    ...Object.entries(r.p1).sort(byNumber).map(([q, v]) => `${q}${v || "·"}`),
    ...Object.entries(r.p2).sort(byNumber).map(([q, v]) => `${q}:${[...v].map((c) => c || "·").join("")}`),
  ];
  return answers.join("  ");
}

function render(): void {
  const rows = store.load().slice().reverse();
  listEl.replaceChildren(
    ...rows.map((r) => {
      const row = document.createElement("article");
      row.className = "row" + (r.ok ? "" : " rejected");
      row.innerHTML = `
        <div class="row-head">
          <strong>${r.studentId || "?"}</strong>
          <span class="muted">đề ${r.examCode || "?"}</span>
          <span class="muted">${new Date(r.at).toLocaleTimeString("vi-VN")}</span>
        </div>
        <div class="answers">${r.ok ? summary(r) : "Chụp lại phiếu này"}</div>
        ${r.ok && r.flags.length ? `<div class="flags">cần xem: ${r.flags.join(", ")}</div>` : ""}
        <button class="ghost remove" data-id="${r.id}">xoá</button>`;
      row.querySelector(".remove")!.addEventListener("click", () => {
        store.remove(r.id);
        render();
      });
      return row;
    }),
  );
  const n = rows.length;
  const bad = rows.filter((r) => !r.ok).length;
  statusEl.textContent = n ? `${n} phiếu · ${bad} cần chụp lại` : "Chưa có phiếu nào.";
}

async function handleFiles(files: FileList | null): Promise<void> {
  const file = files?.[0];
  if (!file) return;
  statusEl.textContent = "Đang chấm…";
  const started = performance.now();
  try {
    const image = await toGray(file);
    const result = gradeSheet(image, tmpl);
    const record = store.add(result);
    const ms = Math.round(performance.now() - started);
    statusEl.textContent = result.ok
      ? `Xong ${ms} ms · mã ${record.studentId} · đề ${record.examCode}` +
        (record.flags.length ? ` · ${record.flags.length} ô cần xem` : "")
      : `Không đọc được phiếu (${result.reason}) · chụp lại, giữ đủ 4 góc và đủ sáng`;
    render();
  } catch (error) {
    statusEl.textContent = `Lỗi: ${(error as Error).message}`;
  } finally {
    fileInput.value = "";
  }
}

fileInput.addEventListener("change", () => void handleFiles(fileInput.files));

$("export").addEventListener("click", () => {
  const rows = store.load();
  if (!rows.length) return;
  download(`ket-qua-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows, tmpl));
});

$("clear").addEventListener("click", () => {
  if (confirm("Xoá toàn bộ kết quả đã chấm?")) {
    store.clear();
    render();
  }
});

render();
