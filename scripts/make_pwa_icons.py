"""Draw Halaqtna's logo: an open Mushaf on its stand (rahl) inside a circle of eight students.

    python scripts/make_pwa_icons.py

One geometry, two outputs: frontend/public/favicon.svg (the mark the app shows) and the PNG
icons the installed app uses, in frontend/public/icons/. Needs numpy only; the PNGs are encoded
with zlib. Edit the shapes below and run it again to change the logo everywhere.

  * icon-192/512: rounded square with transparent corners, for desktops and browsers;
  * icon-maskable-192/512 and apple-touch-icon: full-bleed square, which Android and iOS crop
    to their own shape. All the artwork sits within 180 of the centre, inside the 205-unit
    safe circle that a maskable icon is guaranteed to keep.
"""
import struct
import zlib
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent / "frontend" / "public"
LAPIS, PAPER = (0x1E, 0x3A, 0x5F), (0xF4, 0xF1, 0xE8)
GOLD, GOLD_LIGHT, GOLD_DARK = (0xE3, 0xB5, 0x4F), (0xF2, 0xD1, 0x7E), (0xB9, 0x8A, 0x2E)
SIZE, CORNER = 512, 112
CX = CY = 256
RING_R, DOT_R, DOTS = 158, 19, 8


def bezier(p0, p1, p2, p3, n=24):
    t = np.linspace(0, 1, n)[:, None]
    pts = (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3
    return [tuple(p) for p in pts]


# The left page: spine top -> curved top edge -> outer edge -> curved bottom edge -> spine bottom.
P = lambda x, y: np.array([x, y], dtype=float)
LEFT_PAGE = (bezier(P(256, 200), P(222, 180), P(182, 176), P(148, 188))
             + bezier(P(148, 316), P(182, 304), P(222, 308), P(256, 330)))
RIGHT_PAGE = [(SIZE - x, y) for x, y in LEFT_PAGE]
LINES_Y = (228, 252, 276)          # three lines of text on each page

# Shapes, painted in order: (kind, geometry, colour, alpha).
SHAPES = (
    [("ring", (RING_R, 4), GOLD, 0.9)]
    + [("dot", (CX + RING_R * np.cos(np.radians(-90 + k * 360 / DOTS)), CY + RING_R * np.sin(np.radians(-90 + k * 360 / DOTS)), DOT_R), PAPER, 1.0)
       for k in range(DOTS)]
    + [("bar", ((204, 302), (308, 378), 9), GOLD_DARK, 1.0), ("bar", ((308, 302), (204, 378), 9), GOLD_DARK, 1.0)]
    + [("poly", LEFT_PAGE, GOLD, 1.0), ("poly", RIGHT_PAGE, GOLD_LIGHT, 1.0)]
    + [("bar", ((172, y), (236, y + 6), 3.5), LAPIS, 0.35) for y in LINES_Y]
    + [("bar", ((SIZE - 172, y), (SIZE - 236, y + 6), 3.5), LAPIS, 0.35) for y in LINES_Y]
    + [("bar", ((256, 202), (256, 328), 2.5), LAPIS, 0.55)]
)


def inside(px, py, poly):
    hit = np.zeros(px.shape, dtype=bool)
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        crosses = (y1 > py) != (y2 > py)
        with np.errstate(divide="ignore", invalid="ignore"):
            x_at = (x2 - x1) * (py - y1) / (y2 - y1) + x1
        hit ^= crosses & (px < x_at)
    return hit


def segment_distance(px, py, a, b):
    (ax, ay), (bx, by) = a, b
    dx, dy = bx - ax, by - ay
    t = np.clip(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1)
    return np.hypot(px - (ax + t * dx), py - (ay + t * dy))


def mask(kind, g, px, py):
    if kind == "ring":
        return np.abs(np.hypot(px - CX, py - CY) - g[0]) <= g[1] / 2
    if kind == "dot":
        return np.hypot(px - g[0], py - g[1]) <= g[2]
    if kind == "bar":
        return segment_distance(px, py, g[0], g[1]) <= g[2]
    return inside(px, py, g)


def render(size, rounded, ss=4):
    n = size * ss
    c = (np.arange(n) + 0.5) / ss * (SIZE / size)   # sample positions in logo units
    px, py = np.meshgrid(c, c)
    rgb = np.empty((n, n, 3)); rgb[:] = LAPIS
    for kind, g, colour, alpha in SHAPES:
        m = mask(kind, g, px, py)
        rgb[m] = rgb[m] * (1 - alpha) + np.array(colour) * alpha
    if rounded:   # transparent outside a rounded square
        qx = np.maximum(np.abs(px - CX) - (CX - CORNER), 0)
        qy = np.maximum(np.abs(py - CY) - (CY - CORNER), 0)
        a = (np.hypot(qx, qy) <= CORNER).astype(float)
    else:
        a = np.ones((n, n))
    rgba = np.concatenate([rgb * a[..., None], a[..., None]], axis=2).reshape(size, ss, size, ss, 4).mean(axis=(1, 3))
    alpha = rgba[..., 3:4]
    rgba[..., :3] = np.where(alpha > 0, rgba[..., :3] / np.maximum(alpha, 1e-9), 0)   # un-premultiply
    rgba[..., 3] *= 255
    return np.clip(np.rint(rgba), 0, 255).astype(np.uint8)


def png(pixels):
    h, w, _ = pixels.shape
    raw = b"".join(b"\x00" + pixels[y].tobytes() for y in range(h))
    chunk = lambda kind, data: struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def svg():
    hexc = lambda c: "#%02X%02X%02X" % c
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">',
           f'<rect width="{SIZE}" height="{SIZE}" rx="{CORNER}" fill="{hexc(LAPIS)}"/>']
    for kind, g, colour, alpha in SHAPES:
        op = "" if alpha == 1 else f' opacity="{alpha}"'
        if kind == "ring":
            out.append(f'<circle cx="{CX}" cy="{CY}" r="{g[0]}" fill="none" stroke="{hexc(colour)}" stroke-width="{g[1]}"{op}/>')
        elif kind == "dot":
            out.append(f'<circle cx="{g[0]:.1f}" cy="{g[1]:.1f}" r="{g[2]}" fill="{hexc(colour)}"{op}/>')
        elif kind == "bar":
            (ax, ay), (bx, by), hw = g
            out.append(f'<line x1="{ax}" y1="{ay}" x2="{bx}" y2="{by}" stroke="{hexc(colour)}" stroke-width="{hw * 2}" stroke-linecap="round"{op}/>')
        else:
            pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in g)
            out.append(f'<polygon points="{pts}" fill="{hexc(colour)}"{op}/>')
    out.append("</svg>")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    icons = ROOT / "icons"
    icons.mkdir(parents=True, exist_ok=True)
    (ROOT / "favicon.svg").write_text(svg(), encoding="utf-8")
    print(f"wrote {ROOT / 'favicon.svg'}")
    for name, size, rounded in [("icon-192.png", 192, True), ("icon-512.png", 512, True),
                                ("icon-maskable-192.png", 192, False), ("icon-maskable-512.png", 512, False),
                                ("apple-touch-icon.png", 180, False), ("shortcut-96.png", 96, True)]:
        (icons / name).write_bytes(png(render(size, rounded)))
        print(f"wrote {icons / name}")
