import type { SheetRecord } from "./store";

/** One exam code's answer key: 10 choices, then 5 questions x 6 statements. */
export interface Key {
  p1: string[];
  p2: string[];
}

export interface KeyConfig {
  text: string;
  p1: number;
  p2: number;
  /** "split": each of the 6 statements is worth p2/6; "all": only a full match scores */
  mode: "split" | "all";
}

export interface Score {
  p1: number;
  p2: number;
  total: number;
  correctP1: number;
  correctP2: number;
}

// Trường dùng thang 2 điểm/câu, phải đúng 100% câu mới có điểm: 10 câu phần I
// và 5 câu phần II (cả 6 ý) = 30 điểm.
export const DEFAULT_KEY: KeyConfig = { text: "", p1: 2, p2: 2, mode: "all" };

/**
 * One line per exam code, pasted straight from whatever the teacher already has:
 *
 *   501 ADCBBADDAC DSDSDS SDSDDS ...
 *
 * The first token is the 3-digit code, then 40 letters read in order: 10 answers
 * for PHẦN I, then 30 for PHẦN II (5 questions x 6 statements). "Đ" counts as D.
 */
export function parseKeys(text: string): { keys: Record<string, Key>; errors: string[] } {
  const keys: Record<string, Key> = {};
  const errors: string[] = [];

  text.split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) return;

    const code = raw.match(/^\d{3}/)?.[0];
    if (!code) {
      errors.push(`dòng ${i + 1}: thiếu mã đề 3 số`);
      return;
    }
    const letters = raw
      .slice(raw.indexOf(code) + 3)
      .toUpperCase()
      .replace(/Đ/g, "D")
      .replace(/[^A-DS]/g, "");

    if (letters.length !== 40) {
      errors.push(`dòng ${i + 1}: cần 40 ký tự (10 + 30), đang có ${letters.length}`);
      return;
    }
    if (/[^A-D]/.test(letters.slice(0, 10))) {
      errors.push(`dòng ${i + 1}: phần I chỉ nhận A–D`);
      return;
    }
    if (/[^DS]/.test(letters.slice(10))) {
      errors.push(`dòng ${i + 1}: phần II chỉ nhận D/S`);
      return;
    }

    keys[code] = {
      p1: [...letters.slice(0, 10)],
      p2: Array.from({ length: 5 }, (_, q) => letters.slice(10 + q * 6, 16 + q * 6)),
    };
  });

  return { keys, errors };
}

/** Null when the sheet has no key for its exam code (or was rejected). */
export function score(record: SheetRecord, keys: Record<string, Key>, cfg: KeyConfig): Score | null {
  const key = keys[record.examCode];
  if (!key || !record.ok) return null;

  let correctP1 = 0;
  for (let q = 1; q <= 10; q++) if (record.p1[String(q)] === key.p1[q - 1]) correctP1++;

  let correctP2 = 0;
  let partTwo = 0;
  for (let q = 0; q < 5; q++) {
    const got = record.p2[String(q + 11)] ?? "";
    let matched = 0;
    for (let i = 0; i < 6; i++) if (got[i] === key.p2[q][i]) matched++;
    correctP2 += matched;
    partTwo += cfg.mode === "all" ? (matched === 6 ? cfg.p2 : 0) : (cfg.p2 * matched) / 6;
  }

  const partOne = correctP1 * cfg.p1;
  return {
    p1: partOne,
    p2: partTwo,
    total: partOne + partTwo,
    correctP1,
    correctP2,
  };
}
