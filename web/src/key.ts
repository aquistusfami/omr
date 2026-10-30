import type { SheetRecord } from "./store";

/** One exam code's answer key: 10 choices, then 5 questions x N statements (N = 4 or 6 in practice). */
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
// và 5 câu phần II (đúng hết các ý có trong đáp án) = 30 điểm.
export const DEFAULT_KEY: KeyConfig = { text: "", p1: 2, p2: 2, mode: "all" };

/**
 * One line per exam code, pasted straight from whatever the teacher already has:
 *
 *   501 ADCBBADDAC DSDSDS SDSDDS ...
 *
 * The first token is the 3-digit code, then 10 answers for PHẦN I, then the
 * statements of PHẦN II in order (5 questions x 4 or 6 statements). The form has
 * 6 bubbles per question, but an exam may only ask 4 - the key decides how many
 * are graded, so a 4-statement key needs 10 + 20 = 30 letters. "Đ" counts as D.
 */
export function parseKeys(text: string): { keys: Record<string, Key>; errors: string[] } {
  const keys: Record<string, Key> = {};
  const errors: string[] = [];

  text.split(/\r?\n/).forEach((line, i) => {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) return;

    // the code must start the line and be followed by whitespace: "123. 501 ..."
    // (a pasted STT column) must fail loudly instead of grading 501's answers
    // under code 123
    const code = raw.match(/^(\d{3})\s/)?.[1];
    if (!code) {
      errors.push(`dòng ${i + 1}: phải bắt đầu bằng mã đề 3 số rồi dấu cách`);
      return;
    }
    const letters = raw
      .slice(3)
      .toUpperCase()
      .replace(/Đ/g, "D")
      .replace(/[^A-DS]/g, "");

    const rest = letters.length - 10;
    const perQuestion = rest / 5;
    if (rest < 5 || rest % 5 !== 0 || (perQuestion !== 4 && perQuestion !== 6)) {
      errors.push(
        `dòng ${i + 1}: cần 10 ký tự phần I + 5 câu phần II, mỗi câu 4 hoặc 6 ý (20 hoặc 30 ký tự), đang có ${letters.length}`,
      );
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
      p2: Array.from({ length: 5 }, (_, q) =>
        letters.slice(10 + q * perQuestion, 10 + (q + 1) * perQuestion),
      ),
    };
  });

  return { keys, errors };
}

/**
 * Flags that matter for this exam code. The printed form has 6 bubbles per
 * PHẦN II question; when the exam only asks 4, the last two are always empty and
 * would flag every single sheet as "cần xem".
 */
export function relevantFlags(record: SheetRecord, keys: Record<string, Key>): string[] {
  const key = keys[record.examCode];
  if (!key) return record.flags;
  return record.flags.filter((flag) => {
    const match = flag.match(/^cau(1[1-5])\.([A-F]):/);
    if (!match) return true;
    const question = Number(match[1]) - 11;
    return match[2].charCodeAt(0) - 65 < key.p2[question].length;
  });
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
    // only the statements the exam actually has count; the extra bubbles on the
    // printed form (6 are printed, a 4-statement question uses 4) are ignored
    const wanted = key.p2[q].length;
    let matched = 0;
    for (let i = 0; i < wanted; i++) if (got[i] === key.p2[q][i]) matched++;
    correctP2 += matched;
    partTwo += cfg.mode === "all" ? (matched === wanted ? cfg.p2 : 0) : (cfg.p2 * matched) / wanted;
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
