export interface Pt {
  x: number;
  y: number;
}

/** Bubble lattice: centre = origin + (col, row) * pitch, in canvas units. */
export interface Block {
  origin: [number, number];
  pitch: [number, number];
  cols: number;
  rows: number;
}

interface SectionBase {
  id: string;
  kind: "digits" | "choice" | "truefalse";
}

export interface DigitsSection extends SectionBase {
  kind: "digits";
  block: string;
  positions: number;
  labels: string[];
}

export interface ChoiceSection extends SectionBase {
  kind: "choice";
  choices: string[];
  questions: { q: number; block: string; row: number }[];
}

export interface TrueFalseSection extends SectionBase {
  kind: "truefalse";
  labels: string[];
  rows: number;
  questions: { q: number; block: string; col: number }[];
}

export type Section = DigitsSection | ChoiceSection | TrueFalseSection;

export interface Template {
  schema: number;
  id: string;
  name: string;
  canvas: { width: number; height: number };
  source: { file: string; width: number; height: number };
  bubble: { diameter: number; sample_radius: number };
  anchors: { x: number; y: number; corner: boolean }[];
  source_anchors: { x: number; y: number }[];
  blocks: Record<string, Block>;
  sections: Section[];
}
