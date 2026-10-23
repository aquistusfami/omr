import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { gradeSheet } from "../src/grade";
import { readPgm } from "../src/image";
import type { Template } from "../src/types";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const template = JSON.parse(readFileSync(here("../../fixtures/template.json"), "utf8")) as Template;

const CASES = [0, 1, 2];

describe("gradeSheet on synthetic photos", () => {
  for (const i of CASES) {
    it(`reads sheet-${i}`, () => {
      const img = readPgm(new Uint8Array(readFileSync(here(`fixtures/sheet-${i}.pgm`))));
      const expected = JSON.parse(readFileSync(here(`fixtures/sheet-${i}.json`), "utf8"));
      const r = gradeSheet(img, template);

      expect(r.reason).toBeUndefined();
      expect(r.ok).toBe(true);
      // one mark may be cropped out of frame; the fit must still hold
      expect(r.anchors.used).toBeGreaterThanOrEqual(template.anchors.length - 2);
      expect(r.anchors.residual).toBeLessThan(5);

      const wrong: string[] = [];
      if (r.studentId !== expected.student_id) wrong.push(`id ${r.studentId} != ${expected.student_id}`);
      if (r.examCode !== expected.exam_code) wrong.push(`code ${r.examCode} != ${expected.exam_code}`);
      for (const [q, want] of Object.entries(expected.p1)) {
        const got = r.p1[q]?.value ?? "";
        if (got !== want) wrong.push(`cau${q} ${got} != ${want}`);
      }
      for (const [q, want] of Object.entries(expected.p2 as Record<string, string[]>)) {
        const got = r.p2[q]?.values.join("") ?? "";
        if (got !== want.join("")) wrong.push(`cau${q} ${got} != ${want.join("")}`);
      }
      expect(wrong).toEqual([]);
    });
  }
});
