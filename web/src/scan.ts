import type { GradeResult } from "./grade";

export interface Frame {
  at: number;
  result: GradeResult;
  /** the sheet outline was visible, even if the fit failed */
  marksSeen: boolean;
}

export type Action =
  | { type: "wait" }
  | { type: "accept"; result: GradeResult }
  | { type: "reject"; reason: string };

/**
 * Turns a stream of per-frame readings into "this sheet is done, take it away".
 *
 * The phone sits on a stand and keeps looking at the same spot. A sheet counts
 * as accepted only after two readings a moment apart agree, and the scanner
 * will not accept anything again until the sheet has been removed - otherwise
 * one sheet would be counted every frame.
 */
export class Scanner {
  private state: "idle" | "settle" | "cooldown" = "idle";
  private candidate: GradeResult | null = null;
  private candidateAt = 0;
  private badFrames = 0;
  private emptyFrames = 0;

  constructor(
    private readonly settleMs = 350,
    private readonly badFramesNeeded = 4,
    private readonly emptyFramesNeeded = 2,
  ) {}

  /** Which phase the scanner is in, for the on-screen hint. */
  get phase(): "idle" | "settle" | "cooldown" {
    return this.state;
  }

  /**
   * Cheap check for the cooldown phase: the sheet already counted is still in
   * view, so only its absence matters. Returns true when the scanner re-armed.
   */
  cleared(marksSeen: boolean): boolean {
    if (this.state !== "cooldown") return false;
    this.emptyFrames = marksSeen ? 0 : this.emptyFrames + 1;
    if (this.emptyFrames < this.emptyFramesNeeded) return false;
    this.state = "idle";
    this.emptyFrames = 0;
    return true;
  }

  push({ at, result, marksSeen }: Frame): Action {
    if (this.state === "cooldown") {
      this.emptyFrames = marksSeen ? 0 : this.emptyFrames + 1;
      if (this.emptyFrames >= this.emptyFramesNeeded) {
        this.state = "idle";
        this.emptyFrames = 0;
      }
      return { type: "wait" };
    }

    if (!result.ok) {
      // a sheet can be on the stand but unreadable: say so once, then wait
      // for it to be removed instead of complaining every frame
      this.badFrames = marksSeen ? this.badFrames + 1 : 0;
      if (this.badFrames >= this.badFramesNeeded) {
        this.state = "cooldown";
        this.emptyFrames = 0;
        this.badFrames = 0;
        return { type: "reject", reason: result.reason ?? "anchors" };
      }
      if (this.state === "settle") this.state = "idle";
      return { type: "wait" };
    }

    this.badFrames = 0;
    if (this.state === "idle") {
      this.candidate = result;
      this.candidateAt = at;
      this.state = "settle";
      return { type: "wait" };
    }

    if (!this.candidate || !sameAnswers(this.candidate, result)) {
      this.candidate = result;
      this.candidateAt = at;
      return { type: "wait" };
    }
    if (at - this.candidateAt < this.settleMs) return { type: "wait" };

    this.state = "cooldown";
    this.emptyFrames = 0;
    this.candidate = null;
    return { type: "accept", result };
  }
}

/** Two readings agree only if every answer matches; quality metadata may differ. */
export function sameAnswers(a: GradeResult, b: GradeResult): boolean {
  if (a.studentId !== b.studentId || a.examCode !== b.examCode) return false;
  for (const q of Object.keys(a.p1)) if (a.p1[q].value !== b.p1[q]?.value) return false;
  for (const q of Object.keys(a.p2)) if (a.p2[q].values.join("") !== b.p2[q]?.values.join("")) return false;
  return Object.keys(a.p1).length === Object.keys(b.p1).length;
}
