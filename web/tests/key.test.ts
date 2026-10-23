import { describe, expect, it } from "vitest";

import { parseKeys, score, type KeyConfig } from "../src/key";
import type { SheetRecord } from "../src/store";

const KEY_TEXT = "501 ADCBBADDAC DSDSSS SDSDDS SDSDSD DSSDSS DDSDDS";

const cfg = (mode: KeyConfig["mode"] = "split"): KeyConfig => ({
  text: KEY_TEXT,
  p1: 0.25,
  p2: 0.5,
  mode,
});

function sheet(answers: { p1: string; p2: string[] }, examCode = "501"): SheetRecord {
  return {
    at: 0,
    ok: true,
    studentId: "202511756",
    examCode,
    p1: Object.fromEntries([...answers.p1].map((v, i) => [String(i + 1), v])),
    p2: Object.fromEntries(answers.p2.map((v, i) => [String(i + 11), v])),
    flags: [],
    anchors: { used: 21, residual: 1 },
  };
}

describe("parseKeys", () => {
  it("reads one exam code per line", () => {
    const { keys, errors } = parseKeys(KEY_TEXT);
    expect(errors).toEqual([]);
    expect(keys["501"].p1.join("")).toBe("ADCBBADDAC");
    expect(keys["501"].p2).toEqual(["DSDSSS", "SDSDDS", "SDSDSD", "DSSDSS", "DDSDDS"]);
  });

  it("accepts Đ as D, lower case and any spacing", () => {
    const { keys, errors } = parseKeys("501 adcbbaddac dsđsss sdsdds sdsdsd dssdss ddsdds");
    expect(errors).toEqual([]);
    expect(keys["501"].p2[0]).toBe("DSDSSS");
  });

  it("reports a line that is not 40 answers", () => {
    const { keys, errors } = parseKeys("501 ADCBB\n502 " + "A".repeat(10) + "D".repeat(30));
    expect(Object.keys(keys)).toEqual(["502"]);
    expect(errors[0]).toContain("dòng 1");
  });

  it("ignores blank lines and comments", () => {
    const { keys, errors } = parseKeys(`# mã đề 501\n\n${KEY_TEXT}\n`);
    expect(errors).toEqual([]);
    expect(Object.keys(keys)).toEqual(["501"]);
  });
});

describe("score", () => {
  const { keys } = parseKeys(KEY_TEXT);
  const perfect = sheet({
    p1: "ADCBBADDAC",
    p2: ["DSDSSS", "SDSDDS", "SDSDSD", "DSSDSS", "DDSDDS"],
  });

  it("gives full marks for a perfect sheet", () => {
    const s = score(perfect, keys, cfg())!;
    expect(s).toMatchObject({ p1: 2.5, p2: 2.5, total: 5, correctP1: 10, correctP2: 30 });
  });

  it("counts a wrong choice and a wrong statement", () => {
    const s = score(
      sheet({ p1: "BDCBBADDAC", p2: ["DSDSSS", "SDSDDS", "SDSDSD", "DSSDSS", "DDSDD"] }),
      keys,
      cfg(),
    )!;
    expect(s.correctP1).toBe(9);
    expect(s.correctP2).toBe(29);
    expect(s.total).toBeCloseTo(2.25 + 4 * 0.5 + (5 / 6) * 0.5, 6);
  });

  it("can require all six statements of a question", () => {
    const s = score(
      sheet({ p1: "ADCBBADDAC", p2: ["DSDSSS", "SDSDDS", "SDSDSD", "DSSDSS", "DDSDD"] }),
      keys,
      cfg("all"),
    )!;
    expect(s.total).toBeCloseTo(2.5 + 4 * 0.5, 6);
  });

  it("returns nothing when the exam code has no key", () => {
    expect(score(perfect, keys, cfg())).not.toBeNull();
    expect(score({ ...perfect, examCode: "999" }, keys, cfg())).toBeNull();
  });

  it("treats a blank answer as wrong", () => {
    const s = score(sheet({ p1: "ADCBBADDAC", p2: ["DSDSS?", "SDSDDS", "SDSDSD", "DSSDSS", "DDSDDS"] }), keys, cfg())!;
    expect(s.correctP2).toBe(29);
  });
});
