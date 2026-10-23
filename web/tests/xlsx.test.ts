import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { toXlsx } from "../src/xlsx";

/** Read the stored (uncompressed) entries back out of our own zip. */
function unzip(bytes: Uint8Array): Map<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = bytes.length - 22;
  expect(view.getUint32(eocd, true)).toBe(0x06054b50);
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const out = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(p, true)).toBe(0x02014b50);
    const size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    out.set(name, new TextDecoder().decode(bytes.subarray(dataStart, dataStart + size)));
    p += 46 + nameLen;
  }
  return out;
}

const HEAD = ["stt", "ma_sv", "cau1", "cau11a"];
const BODY = [
  ["1", "045123678", "A", "D"],
  ["2", "123456789", "B", "S"],
];

describe("toXlsx", () => {
  it("produces a readable xlsx package", async () => {
    const blob = toXlsx(HEAD, BODY, "Ket qua");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    writeFileSync(join(tmpdir(), "omr-test.xlsx"), bytes);

    const files = unzip(bytes);
    expect([...files.keys()].sort()).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]);

    const sheet = files.get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain('r="A1"');
    expect(sheet).toContain("045123678"); // leading zero must survive as text
    expect(sheet).toContain('r="D3"');
    expect(sheet).toContain(`<dimension ref="A1:D3"/>`);
    expect(files.get("xl/workbook.xml")).toContain('name="Ket qua"');
  });

  it("escapes xml in cell values", async () => {
    const blob = toXlsx(["a"], [['x & <y> "z"']]);
    const sheet = unzip(new Uint8Array(await blob.arrayBuffer())).get("xl/worksheets/sheet1.xml")!;
    expect(sheet).toContain("x &amp; &lt;y&gt; &quot;z&quot;");
  });
});
