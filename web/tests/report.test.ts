import { describe, expect, it } from "vitest";

import templateJson from "../../fixtures/template.json";
import { DEFAULT_KEY, parseKeys } from "../src/key";
import { buildReport } from "../src/report";
import type { SheetRecord } from "../src/store";
import type { Template } from "../src/types";
import { toWorkbook } from "../src/xlsx";

const tmpl = templateJson as unknown as Template;
const KEY = "501 ADCBBADDAC DSDSSS SDSDDS SDSDSD DSSDSS DDSDDS";
const keys = parseKeys(KEY).keys;
const cfg = { ...DEFAULT_KEY, text: KEY };

const perfect = (studentId: string): SheetRecord => ({
  uid: `uid-${studentId}`,
  at: 1760000000000,
  ok: true,
  studentId,
  examCode: "501",
  p1: { "1": "A", "2": "D", "3": "C", "4": "B", "5": "B", "6": "A", "7": "D", "8": "D", "9": "A", "10": "C" },
  p2: { "11": "DSDSSS", "12": "SDSDDS", "13": "SDSDSD", "14": "DSSDSS", "15": "DDSDDS" },
  flags: [],
  anchors: { used: 21, residual: 0.6 },
});

describe("buildReport", () => {
  it("makes four sheets and scores the perfect sheet 30", () => {
    const rows = [perfect("202511756"), perfect("202511757"), { ...perfect("202511758"), flags: ["cau7:multi"] }];
    const report = buildReport(rows, tmpl, keys, cfg);
    expect(report.map((s) => s.name)).toEqual(["Danh sach", "Phong diem", "Theo ma de", "Nghi van"]);

    const list = report[0];
    expect(list.head).toHaveLength(49);
    expect(list.head[44]).toBe("diem");
    expect(list.body[0][44]).toBe("30.00");

    const dist = report[1].body;
    expect(dist.find((row) => row[0] === "29 – 30")?.[1]).toBe("3");
    expect(dist.find((row) => row[0] === "Điểm trung bình")?.[1]).toBe("30.00");

    expect(report[2].body[0]).toEqual(["501", "3", "30.00", "30.00", "30.00", "1"]);
    expect(report[3].body).toHaveLength(1);
    expect(report[3].body[0][3]).toBe("cau7:multi");
    expect(report[3].body[0][4]).toBe("thumbs/uid-202511758.jpg");
  });

  it("lists rejected sheets under nghi van", () => {
    const report = buildReport(
      [{ at: 0, ok: false, reason: "quality", studentId: "", examCode: "", p1: {}, p2: {}, flags: [], anchors: { used: 4, residual: 9 } }],
      tmpl,
      keys,
      cfg,
    );
    expect(report[3].body[0][3]).toBe("REJECT:quality");
    expect(report[1].body.find((row) => row[0] === "Tổng số phiếu có điểm")?.[1]).toBe("0");
  });

  it("packs every sheet into one workbook", async () => {
    const report = buildReport([perfect("202511756")], tmpl, keys, cfg);
    const blob = toWorkbook(report);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);
    for (const i of [1, 2, 3, 4]) expect(text).toContain(`xl/worksheets/sheet${i}.xml`);
    expect(text).not.toContain("xl/worksheets/sheet5.xml");
  });
});
