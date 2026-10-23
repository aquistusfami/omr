"""Build fixtures/template.json from a flat image of the blank answer sheet.

The sheet is a rigid lattice: every bubble sits on a regular (origin, pitch) grid
inside one of a handful of blocks. We detect the printed marks and the bubble
interiors, fit each block's lattice, and emit canvas-normalised coordinates.

Canvas contract
---------------
The canvas is the rectangle spanned by the two large corner marks and the two
outermost marks of the bottom row. Those four points map to (0,0), (1000,0),
(1000,H), (0,H). Every other coordinate is that same projective transform applied
to the source pixels. Consequence: print scale, margin and paper size do not
matter, only the printed aspect ratio. See docs/02-template-format.md.

Usage
-----
    python3 tools/build_template.py            # write template + overlay
    python3 tools/build_template.py --check    # exit 1 if fixtures are stale
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
FORM = ROOT / "fixtures" / "blank-form.png"
OUT_JSON = ROOT / "fixtures" / "template.json"
OUT_OVERLAY = ROOT / "fixtures" / "template-overlay.png"

CANVAS_WIDTH = 1000.0

# Block layout of this form: source-pixel bbox and the lattice size it must have.
# cols/rows are the printed truth - the leftmost id column touches the table
# border and is not always detected, so the lattice is extended to match.
# See docs/04-sheet-layout.md.
BLOCKS = {
    #   name          x0   x1    y0   y1   cols rows
    "student_id": ((35, 240, 135, 420), 9, 10),
    "exam_code": ((255, 325, 135, 420), 3, 10),
    "p1a": ((100, 245, 515, 600), 4, 4),
    "p1b": ((310, 455, 515, 600), 4, 4),
    "p1c": ((520, 665, 515, 600), 4, 4),
    "p2a": ((100, 245, 715, 860), 4, 6),
    "p2b": ((310, 455, 715, 860), 4, 6),
    "p2c": ((520, 665, 715, 860), 4, 6),
}


def load_gray() -> np.ndarray:
    return np.asarray(Image.open(FORM).convert("L"))


def detect_marks(g: np.ndarray) -> list[dict]:
    """Filled dark squares: the registration marks."""
    lab, _ = ndi.label(g < 110, structure=np.ones((3, 3)))
    marks = []
    for i, s in enumerate(ndi.find_objects(lab), start=1):
        if s is None:
            continue
        y0, y1, x0, x1 = s[0].start, s[0].stop, s[1].start, s[1].stop
        w, h = x1 - x0, y1 - y0
        if not (9 <= w <= 32 and 9 <= h <= 32):
            continue
        area = int((lab[s] == i).sum())
        if area / (w * h) < 0.75 or abs(w - h) > 3:
            continue
        marks.append({"x": x0 + w / 2, "y": y0 + h / 2, "size": float(max(w, h))})
    return sorted(marks, key=lambda m: (round(m["y"] / 20), m["x"]))


def detect_bubbles(g: np.ndarray) -> list[tuple[float, float]]:
    """Ring interiors are closed white discs, so each bubble is one component."""
    lab, _ = ndi.label(g > 170)
    out = []
    for i, s in enumerate(ndi.find_objects(lab), start=1):
        if s is None:
            continue
        y0, y1, x0, x1 = s[0].start, s[0].stop, s[1].start, s[1].stop
        w, h = x1 - x0, y1 - y0
        if not (11 <= w <= 22 and 11 <= h <= 22) or abs(w - h) > 4:
            continue
        area = (lab[s] == i).sum()
        if not 0.6 < area / (w * h) < 0.9:
            continue
        out.append((x0 + w / 2, y0 + h / 2))
    return out


def cluster(vals: list[float], gap: float = 5.0) -> list[float]:
    vals = sorted(vals)
    out: list[list[float]] = [[vals[0]]]
    for v in vals[1:]:
        (out[-1] if v - out[-1][-1] < gap else out.append([]) or out[-1]).append(v)
    return [float(np.mean(c)) for c in out]


def fit_axis(vals: list[float], expected: int) -> tuple[float, float]:
    """Fit vals[i] = origin + pitch*i, extending at the low end if a column is missing."""
    centers = cluster(vals)
    idx = np.arange(len(centers), dtype=float)
    pitch, origin = np.polyfit(idx, centers, 1)
    if len(centers) < expected:                     # missing at the start (clipped by border)
        origin -= pitch * (expected - len(centers))
    return float(origin), float(pitch)


def homography(src: np.ndarray, dst: np.ndarray) -> np.ndarray:
    rows = []
    for (x, y), (u, v) in zip(src, dst):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y, -u])
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y, -v])
    _, _, vt = np.linalg.svd(np.array(rows, dtype=float))
    return (vt[-1] / vt[-1][-1]).reshape(3, 3)


def apply_h(h: np.ndarray, pts) -> np.ndarray:
    p = np.c_[np.asarray(pts, dtype=float), np.ones(len(pts))]
    q = p @ h.T
    return q[:, :2] / q[:, 2:3]


def main() -> None:
    g = load_gray()
    marks = detect_marks(g)
    big = [m for m in marks if m["size"] >= 20]
    if len(big) != 2:
        sys.exit(f"expected the 2 large corner marks, found {len(big)}")

    top = sorted(big, key=lambda m: m["x"])
    small = [m for m in marks if m["size"] < 20]
    lowest = max(m["y"] for m in small)
    bottom_row = [m for m in small if abs(m["y"] - lowest) < 6]
    bl, br = min(bottom_row, key=lambda m: m["x"]), max(bottom_row, key=lambda m: m["x"])

    quad_src = np.array([[top[0]["x"], top[0]["y"]], [top[1]["x"], top[1]["y"]],
                         [br["x"], br["y"]], [bl["x"], bl["y"]]])
    width_src = np.linalg.norm(quad_src[1] - quad_src[0])
    height_src = np.linalg.norm(quad_src[2] - quad_src[3])
    canvas_h = CANVAS_WIDTH * height_src / width_src
    quad_dst = np.array([[0, 0], [CANVAS_WIDTH, 0], [CANVAS_WIDTH, canvas_h], [0, canvas_h]])
    h = homography(quad_src, quad_dst)

    # Canvas-space lattice: transform the origin, take pitch from the transformed
    # neighbours (exact for a projective map, correct to first order per block).
    T = lambda pts: apply_h(h, pts)
    bubbles = detect_bubbles(g)

    blocks, source_lattices = {}, {}
    for name, (box, ncols, nrows) in BLOCKS.items():
        x0, x1, y0, y1 = box
        pts = [(x, y) for x, y in bubbles if x0 <= x <= x1 and y0 <= y <= y1]
        if not pts:
            sys.exit(f"no bubbles detected in block {name}")
        ox, dx = fit_axis([p[0] for p in pts], ncols)
        oy, dy = fit_axis([p[1] for p in pts], nrows)
        source_lattices[name] = (ox, oy, dx, dy, ncols, nrows)
        p0 = T([(ox, oy)])[0]
        px = T([(ox + dx, oy)])[0]
        py = T([(ox, oy + dy)])[0]
        blocks[name] = {
            "origin": [round(float(p0[0]), 2), round(float(p0[1]), 2)],
            "pitch": [round(float(px[0] - p0[0]), 2), round(float(py[1] - p0[1]), 2)],
            "cols": ncols, "rows": nrows,
        }

    anchors = T([(m["x"], m["y"]) for m in marks])
    tmpl = {
        "schema": 1,
        "id": "ptit-15cau",
        "name": "Phiếu trả lời trắc nghiệm 15 câu",
        "canvas": {"width": CANVAS_WIDTH, "height": round(float(canvas_h), 2)},
        "source": {"file": "fixtures/blank-form.png",
                   "width": int(g.shape[1]), "height": int(g.shape[0])},
        "bubble": {"diameter": blocks["student_id"]["pitch"][0], "sample_radius": 0.75},
        "anchors": [
            {"x": round(float(p[0]), 2), "y": round(float(p[1]), 2),
             "corner": m["size"] >= 20}
            for p, m in zip(anchors, marks)
        ],
        "source_anchors": [
            {"x": round(m["x"], 2), "y": round(m["y"], 2)} for m in marks
        ],
        "blocks": blocks,
        "sections": SECTIONS,
    }

    if "--check" in sys.argv:
        try:
            current = json.loads(OUT_JSON.read_text())
        except FileNotFoundError:
            sys.exit("template.json is missing")
        stale = current["blocks"] != blocks or current["canvas"] != tmpl["canvas"]
        print("template.json is STALE" if stale else "template.json is up to date")
        sys.exit(1 if stale else 0)

    OUT_JSON.write_text(json.dumps(tmpl, indent=2, ensure_ascii=False) + "\n")
    print(f"template -> {OUT_JSON.relative_to(ROOT)}")
    draw_overlay(lattices=source_lattices, marks=marks, radius=blocks["student_id"]["pitch"][0] / 2)
    check_fit(source_lattices, bubbles)


def draw_overlay(lattices, marks, radius: float) -> None:
    im = Image.open(FORM).convert("RGB")
    d = ImageDraw.Draw(im)
    for ox, oy, dx, dy, ncols, nrows in lattices.values():
        for j in range(nrows):
            for i in range(ncols):
                x, y = ox + i * dx, oy + j * dy
                d.ellipse([x - radius, y - radius, x + radius, y + radius],
                          outline="lime", width=1)
    for m in marks:
        s = 8 if m["size"] >= 20 else 5
        d.rectangle([m["x"] - s, m["y"] - s, m["x"] + s, m["y"] + s], outline="red", width=2)
    im.save(OUT_OVERLAY)
    print(f"overlay -> {OUT_OVERLAY.relative_to(ROOT)}")


def check_fit(lattices, bubbles) -> None:
    """Worst distance from a detected bubble to its nearest lattice point, per block."""
    from scipy.spatial import cKDTree
    pts = np.array(bubbles)
    worst = (0.0, None)
    for name, (ox, oy, dx, dy, ncols, nrows) in lattices.items():
        box = BLOCKS[name][0]
        x0, x1, y0, y1 = box
        inblock = pts[(pts[:, 0] >= x0) & (pts[:, 0] <= x1) &
                      (pts[:, 1] >= y0) & (pts[:, 1] <= y1)]
        grid = np.array([(ox + i * dx, oy + j * dy)
                         for j in range(nrows) for i in range(ncols)])
        d, _ = cKDTree(grid).query(inblock)
        printable = f"{name}({len(inblock)}/{ncols * nrows})"
        if len(inblock) < ncols * nrows - 1:
            print(f"  note: {printable} fewer bubbles detected than the lattice has")
        if d.max() > worst[0]:
            worst = (float(d.max()), printable)
    print(f"worst bubble-to-lattice distance: {worst[0]:.2f}px in {worst[1]}")
    if worst[0] > 4:
        sys.exit("lattice fit is off by more than 4px - check BLOCKS")


# Semantic mapping of the lattices. Edit here when the form changes.
SECTIONS = [
    {"id": "student_id", "kind": "digits", "block": "student_id",
     "positions": 9, "labels": list("0123456789")},
    {"id": "exam_code", "kind": "digits", "block": "exam_code",
     "positions": 3, "labels": list("0123456789")},
    {"id": "p1", "kind": "choice", "choices": ["A", "B", "C", "D"],
     "questions": [
         {"q": 1, "block": "p1a", "row": 0}, {"q": 2, "block": "p1a", "row": 1},
         {"q": 3, "block": "p1a", "row": 2}, {"q": 4, "block": "p1a", "row": 3},
         {"q": 5, "block": "p1b", "row": 0}, {"q": 6, "block": "p1b", "row": 1},
         {"q": 7, "block": "p1b", "row": 2}, {"q": 8, "block": "p1b", "row": 3},
         {"q": 9, "block": "p1c", "row": 0}, {"q": 10, "block": "p1c", "row": 1}]},
    {"id": "p2", "kind": "truefalse", "labels": ["D", "S"], "rows": 6,
     "questions": [
         {"q": 11, "block": "p2a", "col": 0}, {"q": 12, "block": "p2a", "col": 2},
         {"q": 13, "block": "p2b", "col": 0}, {"q": 14, "block": "p2b", "col": 2},
         {"q": 15, "block": "p2c", "col": 0}]},
]


if __name__ == "__main__":
    main()
