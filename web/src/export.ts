import type { Template } from "./types";
import type { SheetRecord } from "./store";

/** One row per sheet, one column per answer unit. Missing/ambiguous answers stay blank. */
export function toCsv(rows: SheetRecord[], tmpl: Template): string {
  const questions = tmpl.sections
    .filter((s) => s.kind === "choice")
    .flatMap((s) => (s.kind === "choice" ? s.questions.map((q) => `cau${q.q}`) : []));
  const tf = tmpl.sections
    .filter((s) => s.kind === "truefalse")
    .flatMap((s) =>
      s.kind === "truefalse"
        ? s.questions.flatMap((q) =>
            Array.from({ length: s.rows }, (_, i) => `cau${q.q}${String.fromCharCode(97 + i)}`),
          )
        : [],
    );

  const head = ["stt", "thoi_gian", "ma_sv", "ma_de", ...questions, ...tf, "can_kiem_tra"];
  const lines = rows.map((r, i) => {
    const cells = [
      String(i + 1),
      new Date(r.at).toISOString(),
      r.studentId,
      r.examCode,
      ...questions.map((q) => r.p1[q.replace("cau", "")] ?? ""),
      ...tf.map((label) => {
        const [, q, part] = label.match(/cau(\d+)([a-f])/)!;
        return r.p2[q]?.[part.charCodeAt(0) - 97] ?? "";
      }),
      r.ok ? r.flags.join(" ") : `REJECT:${r.reason ?? ""}`,
    ];
    return cells.map(escape).join(",");
  });
  return [head.join(","), ...lines].join("\n");
}

function escape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
