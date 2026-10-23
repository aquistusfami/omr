import { findAnchors } from "./anchors";
import { discMean, warp, type Gray } from "./image";
import type { ChoiceSection, DigitsSection, Template, TrueFalseSection } from "./types";

export type Flag = "ok" | "blank" | "multi" | "ambiguous";

export interface Unit {
  value: string;
  flag: Flag;
  confidence: number;
}

export interface GradeResult {
  ok: boolean;
  reason?: string;
  studentId: string;
  examCode: string;
  p1: Record<string, Unit>;
  p2: Record<string, { values: string[]; flags: Flag[]; confidence: number }>;
  flags: string[];
  anchors: { used: number; residual: number };
  /** rectified page, only when the caller asks for it (thumbnail / review) */
  canvas?: Gray;
}

/** Output pixels per canvas unit. 1.5 gives a bubble of ~33 px. */
const SCALE = 1.5;

/**
 * Pick the marked option out of the candidates of one answer.
 * Everything is relative inside the unit, so a lighting gradient or a dark
 * photo does not change the outcome. Absolute checks only guard the two
 * degenerate cases: nothing marked, and several options marked.
 */
export function classify(candidates: { label: string; value: number }[]): Unit {
  if (!candidates.length) return { value: "", flag: "blank", confidence: 0 };
  const sorted = [...candidates].sort((a, b) => a.value - b.value);
  const darkest = sorted[0];
  const runnerUp = sorted[1]?.value ?? 255;
  const brightest = sorted[sorted.length - 1].value;
  const gap = runnerUp - darkest.value;
  const hasInk = darkest.value < brightest * 0.7;
  const minGap = Math.max(20, brightest * 0.1);

  if (!hasInk) return { value: "", flag: "blank", confidence: 0 };
  if (gap >= minGap) {
    return { value: darkest.label, flag: "ok", confidence: Math.min(1, gap / (brightest * 0.45)) };
  }
  return { value: darkest.label, flag: "multi", confidence: 0 };
}

function blockValues(canvas: Gray, tmpl: Template, block: string): number[][] {
  const b = tmpl.blocks[block];
  const radius = (tmpl.bubble.diameter / 2) * tmpl.bubble.sample_radius * SCALE;
  const rows: number[][] = [];
  for (let j = 0; j < b.rows; j++) {
    const row: number[] = [];
    for (let i = 0; i < b.cols; i++) {
      const x = (b.origin[0] + i * b.pitch[0]) * SCALE;
      const y = (b.origin[1] + j * b.pitch[1]) * SCALE;
      row.push(discMean(canvas, x, y, radius));
    }
    rows.push(row);
  }
  return rows;
}

export function gradeSheet(
  image: Gray,
  tmpl: Template,
  options: { keepCanvas?: boolean } = {},
): GradeResult {
  const match = findAnchors(image, tmpl);
  const empty: GradeResult = {
    ok: false,
    studentId: "",
    examCode: "",
    p1: {},
    p2: {},
    flags: [],
    anchors: { used: 0, residual: 0 },
  };
  if (!match) return { ...empty, reason: "anchors" };
  // a bad fit is worse than a rejected sheet: the readings would look confident
  const residualLimit = image.width * 0.0025;
  if (match.used < tmpl.anchors.length * 0.7 || match.residual > residualLimit) {
    return {
      ...empty,
      reason: match.residual > residualLimit ? "quality" : "anchors",
      anchors: { used: match.used, residual: Math.round(match.residual * 10) / 10 },
    };
  }

  const outWidth = Math.round(tmpl.canvas.width * SCALE);
  const outHeight = Math.round(tmpl.canvas.height * SCALE);
  const canvas = warp(image, match.h, outWidth, outHeight, SCALE);

  const values: Record<string, number[][]> = {};
  for (const block of Object.keys(tmpl.blocks)) values[block] = blockValues(canvas, tmpl, block);

  const result: GradeResult = {
    ok: true,
    studentId: "",
    examCode: "",
    p1: {},
    p2: {},
    flags: [],
    anchors: { used: match.used, residual: Math.round(match.residual * 10) / 10 },
    canvas: options.keepCanvas ? canvas : undefined,
  };

  const note = (where: string, unit: Unit) => {
    if (unit.flag !== "ok") result.flags.push(`${where}:${unit.flag}`);
  };

  for (const section of tmpl.sections) {
    if (section.kind === "digits") {
      const s = section as DigitsSection;
      const rows = values[s.block];            // rows[digit][position]
      let text = "";
      for (let pos = 0; pos < s.positions; pos++) {
        const unit = classify(rows.map((row, digit) => ({ label: s.labels[digit], value: row[pos] })));
        text += unit.value || "?";
        note(`${s.id}[${pos + 1}]`, unit);
      }
      if (s.id === "student_id") result.studentId = text;
      if (s.id === "exam_code") result.examCode = text;
    }

    if (section.kind === "choice") {
      const s = section as ChoiceSection;
      for (const q of s.questions) {
        const row = values[q.block][q.row];
        const unit = classify(s.choices.map((label, i) => ({ label, value: row[i] })));
        result.p1[String(q.q)] = unit;
        note(`cau${q.q}`, unit);
        if (q.row >= tmpl.blocks[q.block].rows) throw new Error(`row out of range for ${q.block}`);
      }
    }

    if (section.kind === "truefalse") {
      const s = section as TrueFalseSection;
      for (const q of s.questions) {
        const rows = values[q.block];
        const values2: string[] = [];
        const flags: Flag[] = [];
        let worst = 1;
        for (let r = 0; r < s.rows; r++) {
          const pair = [
            { label: s.labels[0], value: rows[r][q.col] },
            { label: s.labels[1], value: rows[r][q.col + 1] },
          ];
          const unit = classify(pair);
          values2.push(unit.value);
          flags.push(unit.flag);
          worst = Math.min(worst, unit.confidence);
          note(`cau${q.q}.${String.fromCharCode(65 + r)}`, unit);
        }
        result.p2[String(q.q)] = { values: values2, flags, confidence: worst };
      }
    }
  }

  return result;
}
