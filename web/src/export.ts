import type { Template } from "./types";
import type { SheetRecord } from "./store";

export interface Table {
  head: string[];
  body: string[][];
}

/** One row per sheet, one column per answer. Shared by CSV and XLSX so they never diverge. */
export function tableData(rows: SheetRecord[], tmpl: Template): Table {
  const questions = tmpl.sections
    .filter((s) => s.kind === "choice")
    .flatMap((s) => (s.kind === "choice" ? s.questions.map((q) => `cau${q.q}`) : []));
  const statements = tmpl.sections
    .filter((s) => s.kind === "truefalse")
    .flatMap((s) =>
      s.kind === "truefalse"
        ? s.questions.flatMap((q) =>
            Array.from({ length: s.rows }, (_, i) => `${q.q}${String.fromCharCode(97 + i)}`),
          )
        : [],
    );

  const head = ["stt", "thoi_gian", "ma_sv", "ma_de", ...questions, ...statements, "trung", "can_kiem_tra"];
  const body = rows.map((r, i) => [
    String(i + 1),
    new Date(r.at).toISOString(),
    r.studentId,
    r.examCode,
    ...questions.map((q) => r.p1[q.replace("cau", "")] ?? ""),
    ...statements.map((label) => {
      const [, q, part] = label.match(/^(\d+)([a-f])$/)!;
      return r.p2[q]?.[part.charCodeAt(0) - 97] ?? "";
    }),
    r.duplicate ? "x" : "",
    r.ok ? r.flags.join(" ") : `REJECT:${r.reason ?? ""}`,
  ]);
  return { head, body };
}

export function toCsv(table: Table): string {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [table.head, ...table.body].map((row) => row.map(escape).join(",")).join("\n");
}

export function toJson(rows: SheetRecord[], tmpl: Template): string {
  return JSON.stringify(
    { template: tmpl.id, exportedAt: new Date().toISOString(), count: rows.length, sheets: rows },
    null,
    2,
  );
}

export function download(name: string, data: Blob | string): void {
  const blob = typeof data === "string" ? new Blob(["\ufeff" + data], { type: "text/plain;charset=utf-8" }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
