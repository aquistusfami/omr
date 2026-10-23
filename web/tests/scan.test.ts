import { describe, expect, it } from "vitest";

import type { GradeResult } from "../src/grade";
import { Scanner } from "../src/scan";

function result(id = "123456789", q1 = "A", ok = true): GradeResult {
  return {
    ok,
    reason: ok ? undefined : "quality",
    studentId: id,
    examCode: "042",
    p1: { "1": { value: q1, flag: "ok", confidence: 1 } },
    p2: { "11": { values: ["D", "S", "", "", "", ""], flags: [], confidence: 1 } },
    flags: [],
    anchors: { used: ok ? 21 : 3, residual: 0.5 },
  };
}

const frame = (at: number, r: GradeResult, marksSeen = true) => ({ at, result: r, marksSeen });

describe("Scanner", () => {
  it("accepts only after two matching readings", () => {
    const s = new Scanner(350);
    expect(s.push(frame(0, result())).type).toBe("wait");
    expect(s.phase).toBe("settle");
    expect(s.push(frame(200, result())).type).toBe("wait");
    expect(s.push(frame(400, result())).type).toBe("accept");
    expect(s.phase).toBe("cooldown");
  });

  it("does not count the same sheet twice", () => {
    const s = new Scanner(350);
    s.push(frame(0, result()));
    expect(s.push(frame(400, result())).type).toBe("accept");
    for (let t = 500; t < 4000; t += 250) expect(s.push(frame(t, result())).type).toBe("wait");
  });

  it("re-arms only after the sheet is removed", () => {
    const s = new Scanner(350);
    s.push(frame(0, result()));
    s.push(frame(400, result()));
    expect(s.push(frame(600, result(), false)).type).toBe("wait");
    expect(s.push(frame(800, result(), false)).type).toBe("wait");
    expect(s.phase).toBe("idle");
    expect(s.push(frame(1000, result())).type).toBe("wait");
    expect(s.push(frame(1400, result())).type).toBe("accept");
  });

  it("starts over when the answers change mid-settle", () => {
    const s = new Scanner(350);
    s.push(frame(0, result("111111111", "A")));
    expect(s.push(frame(200, result("222222222", "B"))).type).toBe("wait");
    expect(s.push(frame(300, result("111111111", "A"))).type).toBe("wait");
    expect(s.push(frame(800, result("111111111", "A"))).type).toBe("accept");
  });

  it("reports an unreadable sheet once, then waits for it to be taken away", () => {
    const s = new Scanner(350);
    const bad = result("", "", false);
    s.push(frame(0, bad));
    s.push(frame(250, bad));
    s.push(frame(500, bad));
    expect(s.push(frame(750, bad)).type).toBe("reject");
    expect(s.phase).toBe("cooldown");
    for (let t = 900; t < 2000; t += 250) expect(s.push(frame(t, bad)).type).toBe("wait");
  });

  it("stays quiet when no sheet is under the camera", () => {
    const s = new Scanner(350);
    const empty = result("", "", false);
    for (let t = 0; t < 3000; t += 250) {
      expect(s.push(frame(t, empty, false)).type).toBe("wait");
    }
    expect(s.phase).toBe("idle");
  });
});
