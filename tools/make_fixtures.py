"""Render synthetic photos of filled answer sheets, for tests and for eyeballing
the pipeline without waiting for exam day.

A real camera photo is not a flat scan: perspective, page curvature, uneven light
and sensor noise all matter. This tool approximates the first, third and fourth
well enough to catch the usual mistakes.

    python3 tools/make_fixtures.py                 # writes web/tests/fixtures/*
    python3 tools/make_fixtures.py --count 20      # a larger sample for accuracy runs
"""

from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
FORM = ROOT / "fixtures" / "blank-form.png"
TEMPLATE = ROOT / "fixtures" / "template.json"
OUT = ROOT / "web" / "tests" / "fixtures"

WIDTH = 1400      # simulated photo width in px


def source_transform(tmpl: dict) -> np.ndarray:
    """Source pixels -> canvas, recovered from the stored anchor pairs."""
    src = np.array([[a["x"], a["y"]] for a in tmpl["source_anchors"]])
    dst = np.array([[a["x"], a["y"]] for a in tmpl["anchors"]])
    m = []
    for (x, y), (u, v) in zip(src, dst):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y, v])
    m = np.array(m, dtype=float)
    coef = np.linalg.lstsq(m[:, :8], m[:, 8], rcond=None)[0]
    return np.array([[coef[0], coef[1], coef[2]],
                     [coef[3], coef[4], coef[5]],
                     [coef[6], coef[7], 1.0]])


def centres(tmpl: dict, block: str) -> list[tuple[float, float]]:
    b = tmpl["blocks"][block]
    ox, oy = b["origin"]
    dx, dy = b["pitch"]
    return [(ox + i * dx, oy + j * dy) for j in range(b["rows"]) for i in range(b["cols"])]


def fill_bubbles(img: Image.Image, tmpl: dict, answers: dict, faint: bool = False) -> None:
    """answers: {"student_id": "123456789", "exam_code": "042",
                 "p1": {"1": "A", ...}, "p2": {"11": ["D", "S", ...], ...}}"""
    from PIL import ImageDraw

    d = ImageDraw.Draw(img)
    to_src = np.linalg.inv(source_transform(tmpl))
    scale = img.width / tmpl["source"]["width"]
    r = tmpl["bubble"]["diameter"] / 2 * scale * 0.86

    def blobs(points):
        for cx, cy in points:
            q = to_src @ np.array([cx, cy, 1.0])
            x, y = q[0] / q[2] * scale, q[1] / q[2] * scale
            # faint: a light pencil mark, the kind that scans at ~75-80% of the paper
            d.ellipse([x - r, y - r, x + r, y + r],
                      fill=random.randint(168, 196) if faint else random.randint(25, 55))

    def at(block: str, col: int, row: int):
        pts = centres(tmpl, block)
        cols = tmpl["blocks"][block]["cols"]
        return pts[row * cols + col]

    for sec in tmpl["sections"]:
        if sec["kind"] == "digits":
            text = answers.get(sec["id"], "")
            blobs([at(sec["block"], pos, int(ch)) for pos, ch in enumerate(text)])

        elif sec["kind"] == "choice":
            for q in sec["questions"]:
                pick = answers.get(sec["id"], {}).get(str(q["q"]), "")
                if pick:
                    blobs([at(q["block"], sec["choices"].index(pick), q["row"])])

        elif sec["kind"] == "truefalse":
            for q in sec["questions"]:
                for row, mark in enumerate(answers.get(sec["id"], {}).get(str(q["q"]), [])):
                    if mark in ("D", "S"):
                        blobs([at(q["block"], q["col"] + (mark == "S"), row)])


def to_pgm(arr: np.ndarray, path: Path) -> None:
    path.write_bytes(b"P5\n%d %d\n255\n" % (arr.shape[1], arr.shape[0]) + arr.astype(np.uint8).tobytes())


def render(tmpl: dict, answers: dict, seed: int, page: bool = False, faint: bool = False) -> np.ndarray:
    random.seed(seed)
    np.random.seed(seed)
    base = Image.open(FORM).convert("L").resize((WIDTH, WIDTH * 891 // 960), Image.LANCZOS)
    fill_bubbles(base, tmpl, answers, faint)
    base = base.filter(ImageFilter.GaussianBlur(1.2))

    if page:
        # A scanned A4 sheet: the form sits in the top part and four large corner
        # marks frame the whole page - the bottom two are far outside the form's
        # own anchors, which used to stretch the fit's search box.
        from PIL import ImageDraw

        page_w, page_h = 1240, 1754
        page_img = Image.new("L", (page_w, page_h), 238)
        # the form keeps its aspect ratio and sits in the top ~55% of the page
        form_w = page_w - 90
        base = base.resize((form_w, round(form_w * 891 / 960)), Image.LANCZOS)
        page_img.paste(base, ((page_w - base.width) // 2, 40))
        d = ImageDraw.Draw(page_img)
        for x, y in ((60, 45), (1130, 45), (60, 1180), (1130, 1660)):
            d.rectangle([x - 18, y - 5, x + 18, y + 5], fill=30)
            d.rectangle([x - 5, y - 18, x + 5, y + 18], fill=30)
        d.rectangle([40, 1230, page_w - 40, 1600], outline=120, width=3)
        base = page_img

    # perspective: jitter the four corners by up to 4%
    w, h = base.size
    j = lambda: random.uniform(-0.04, 0.04)
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    dst = [(j() * w, j() * h), (w + j() * w, j() * h),
           (w + j() * w, h + j() * h), (j() * w, h + j() * h)]
    m = []
    for (x, y), (u, v) in zip(src, dst):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y, u])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y, v])
    m = np.array(m, dtype=float)
    coef = np.linalg.solve(m[:, :8], m[:, 8])
    hmat = np.array([[coef[0], coef[1], coef[2]],
                     [coef[3], coef[4], coef[5]],
                     [coef[6], coef[7], 1.0]])
    inv = np.linalg.inv(hmat)
    photo = base.transform((w, h), Image.PERSPECTIVE,
                           tuple(inv.flatten()[:8]), Image.BICUBIC, fillcolor=235)

    arr = np.asarray(photo, dtype=np.float32)

    # uneven light + vignette + noise
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    light = 1.0 - 0.28 * (((xx - w * random.uniform(0.2, 0.8)) / w) ** 2 +
                          ((yy - h * random.uniform(0.2, 0.8)) / h) ** 2)
    arr = arr * np.clip(light, 0.55, 1.05)
    if page:
        # scanner vignette: the bottom of the page is clearly darker than the top
        arr = arr * (1.0 - 0.22 * yy / h)
    arr += np.random.normal(0, 3.5, arr.shape)
    return np.clip(arr, 0, 255)


def random_answers(tmpl: dict) -> dict:
    ans = {"student_id": "".join(random.choice("0123456789") for _ in range(9)),
           "exam_code": "".join(random.choice("0123456789") for _ in range(3)),
           "p1": {}, "p2": {}}
    for sec in tmpl["sections"]:
        if sec["kind"] == "choice":
            for q in sec["questions"]:
                ans["p1"][str(q["q"])] = random.choice(sec["choices"])
        if sec["kind"] == "truefalse":
            for q in sec["questions"]:
                ans["p2"][str(q["q"])] = [random.choice("DS") for _ in range(sec["rows"])]
    return ans


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--count", type=int, default=3)
    p.add_argument("--seed", type=int, default=7)
    p.add_argument("--out", type=Path, default=OUT)
    p.add_argument("--page", action="store_true", help="portrait A4 page with corner frame marks")
    p.add_argument("--faint", action="store_true", help="light pencil fills instead of dark ones")
    args = p.parse_args()

    tmpl = json.loads(TEMPLATE.read_text())
    args.out.mkdir(parents=True, exist_ok=True)
    for i in range(args.count):
        seed = args.seed + i
        answers = random_answers(tmpl)
        arr = render(tmpl, answers, seed, args.page, args.faint)
        name = "portrait" if args.page else "sheet"
        to_pgm(arr, args.out / f"{name}-{i}.pgm")
        (args.out / f"{name}-{i}.json").write_text(json.dumps(answers, indent=2))
    print(f"wrote {args.count} sheet(s) to {args.out}")


if __name__ == "__main__":
    main()
