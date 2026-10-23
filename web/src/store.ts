import type { GradeResult } from "./grade";

export interface SheetRecord {
  id: string;
  at: number;
  ok: boolean;
  reason?: string;
  studentId: string;
  examCode: string;
  p1: Record<string, string>;
  p2: Record<string, string>;
  flags: string[];
  anchors: { used: number; residual: number };
}

const KEY = "omr:sheets:v1";

export function load(): SheetRecord[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as SheetRecord[];
  } catch {
    return [];
  }
}

export function add(result: GradeResult, at = Date.now()): SheetRecord {
  const record: SheetRecord = {
    id: `${at}-${Math.random().toString(36).slice(2, 7)}`,
    at,
    ok: result.ok,
    reason: result.reason,
    studentId: result.studentId,
    examCode: result.examCode,
    p1: Object.fromEntries(Object.entries(result.p1).map(([q, u]) => [q, u.value])),
    p2: Object.fromEntries(Object.entries(result.p2).map(([q, u]) => [q, u.values.join("")])),
    flags: result.flags,
    anchors: result.anchors,
  };
  const all = load();
  all.push(record);
  localStorage.setItem(KEY, JSON.stringify(all));
  return record;
}

export function remove(id: string): SheetRecord[] {
  const all = load().filter((r) => r.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
  return all;
}

export function clear(): void {
  localStorage.removeItem(KEY);
}
