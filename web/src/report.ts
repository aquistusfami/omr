import { tableData } from "./export";
import { score, type Key, type KeyConfig } from "./key";
import type { SheetRecord } from "./store";
import type { Template } from "./types";
import type { Sheet } from "./xlsx";

const round = (v: number) => Math.round(v * 100) / 100;

function stats(values: number[]): { avg: number; median: number; max: number; min: number } {
  if (!values.length) return { avg: 0, median: 0, max: 0, min: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return {
    avg: round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    median: round(sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2),
    max: round(sorted[sorted.length - 1]),
    min: round(sorted[0]),
  };
}

/**
 * The whole report is built on the phone so the laptop only has to open the file:
 * no Python, no server, no network. Statistics are recomputed every time, so
 * editing the answer key changes every number.
 */
export function buildReport(
  rows: SheetRecord[],
  tmpl: Template,
  keys: Record<string, Key>,
  cfg: KeyConfig,
): Sheet[] {
  const list = tableData(rows, tmpl, { keys, cfg });
  const maxScore = 10 * cfg.p1 + 5 * cfg.p2;

  const scored = rows
    .map((record) => ({ record, result: score(record, keys, cfg) }))
    .filter((row): row is { record: SheetRecord; result: NonNullable<ReturnType<typeof score>> } => !!row.result);

  const totals = scored.map((row) => row.result.total);
  const overall = stats(totals);

  const buckets: string[][] = [];
  for (let mark = 0; mark < Math.ceil(maxScore); mark++) {
    const top = Math.min(mark + 1, maxScore);
    const count = totals.filter((t) => t >= mark && t <= top && (t < top || top === maxScore)).length;
    buckets.push([`${mark} – ${round(top)}`, String(count)]);
  }
  const distribution: string[][] = [
    ...buckets,
    ["", ""],
    ["Tổng số phiếu có điểm", String(totals.length)],
    ["Điểm trung bình", overall.avg.toFixed(2)],
    ["Trung vị", overall.median.toFixed(2)],
    ["Cao nhất", overall.max.toFixed(2)],
    ["Thấp nhất", overall.min.toFixed(2)],
    ["Thang điểm", `0 – ${round(maxScore)}`],
  ];

  const codes = [...new Set(rows.map((r) => r.examCode).filter(Boolean))].sort();
  const byCode: string[][] = codes.map((code) => {
    const ofCode = scored.filter((row) => row.record.examCode === code);
    const s = stats(ofCode.map((row) => row.result.total));
    const flagged = rows.filter((r) => r.examCode === code && (r.flags.length || !r.ok)).length;
    return [
      code,
      String(rows.filter((r) => r.examCode === code).length),
      ofCode.length ? s.avg.toFixed(2) : "—",
      ofCode.length ? s.max.toFixed(2) : "—",
      ofCode.length ? s.min.toFixed(2) : "—",
      String(flagged),
    ];
  });
  if (!codes.length) byCode.push(["—", String(rows.length), "—", "—", "—", ""]);

  const doubtful: string[][] = rows
    .filter((r) => !r.ok || r.flags.length || r.duplicate)
    .map((r) => {
      const result = score(r, keys, cfg);
      const why = [
        r.ok ? "" : `REJECT:${r.reason ?? ""}`,
        r.duplicate ? "trùng mã SV" : "",
        ...r.flags,
      ]
        .filter(Boolean)
        .join(" ");
      return [
        r.studentId || "?",
        r.examCode || "?",
        result ? result.total.toFixed(2) : "—",
        why,
        r.uid ? `thumbs/${r.uid}.jpg` : "",
      ];
    });

  return [
    { name: "Danh sach", head: list.head, body: list.body },
    { name: "Phong diem", head: ["Khoảng điểm", "Số phiếu"], body: distribution },
    {
      name: "Theo ma de",
      head: ["Mã đề", "Số phiếu", "Điểm TB", "Cao nhất", "Thấp nhất", "Có ô cần xem"],
      body: byCode,
    },
    {
      name: "Nghi van",
      head: ["Mã SV", "Mã đề", "Điểm", "Lý do", "Ảnh"],
      body: doubtful,
    },
  ];
}
