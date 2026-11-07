"""Draw the installable-app icons from the rub el hizb in frontend/public/favicon.svg.

    python scripts/make_pwa_icons.py

Writes PNGs to frontend/public/icons/. Needs numpy only (the PNG is encoded with zlib), so it
runs wherever the ML service's requirements are installed. The star is the favicon's polygon,
drawn in paper on a lapis ground; the maskable icon keeps it inside the 80% safe circle that
Android crops to.
"""
import struct
import zlib
from pathlib import Path

import numpy as np

OUT = Path(__file__).resolve().parent.parent / "frontend" / "public" / "icons"
LAPIS = (0x1E, 0x3A, 0x5F)
PAPER = (0xF4, 0xF1, 0xE8)
# The favicon's 16-point outline in its 24-unit box, centred on (12, 12).
STAR = [(5.5, 5.5), (9.31, 5.5), (12, 2.81), (14.69, 5.5), (18.5, 5.5), (18.5, 9.31), (21.19, 12), (18.5, 14.69),
        (18.5, 18.5), (14.69, 18.5), (12, 21.19), (9.31, 18.5), (5.5, 18.5), (5.5, 14.69), (2.81, 12), (5.5, 9.31)]
STAR_RADIUS = 9.19          # centre to the outermost points, in favicon units
RING_RADIUS, RING_WIDTH = 3.4, 1.3
SUPERSAMPLE = 4


def inside(px, py, poly):
    """Even-odd point-in-polygon test over whole pixel grids."""
    hit = np.zeros(px.shape, dtype=bool)
    for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
        crosses = (y1 > py) != (y2 > py)
        with np.errstate(divide="ignore", invalid="ignore"):
            x_at = (x2 - x1) * (py - y1) / (y2 - y1) + x1
        hit ^= crosses & (px < x_at)
    return hit


def draw(size, star_fraction):
    """star_fraction: the star's outer radius as a share of the icon's side."""
    n = size * SUPERSAMPLE
    c = (np.arange(n) + 0.5) / SUPERSAMPLE
    px, py = np.meshgrid(c, c)
    scale = star_fraction * size / STAR_RADIUS
    poly = [(size / 2 + (x - 12) * scale, size / 2 + (y - 12) * scale) for x, y in STAR]
    star = inside(px, py, poly)
    d = np.hypot(px - size / 2, py - size / 2)
    ring = np.abs(d - RING_RADIUS * scale) <= RING_WIDTH * scale / 2

    img = np.empty((n, n, 3), dtype=np.float64)
    img[:] = LAPIS
    img[star] = PAPER
    img[star & ring] = LAPIS
    # Average each SUPERSAMPLE x SUPERSAMPLE block: smooth edges without a graphics library.
    img = img.reshape(size, SUPERSAMPLE, size, SUPERSAMPLE, 3).mean(axis=(1, 3))
    return np.clip(np.rint(img), 0, 255).astype(np.uint8)


def png(pixels):
    h, w, _ = pixels.shape
    raw = b"".join(b"\x00" + pixels[y].tobytes() for y in range(h))
    chunk = lambda kind, data: struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size, fraction in [("icon-192.png", 192, 0.40), ("icon-512.png", 512, 0.40),
                                 ("icon-maskable-512.png", 512, 0.32), ("apple-touch-icon.png", 180, 0.36)]:
        (OUT / name).write_bytes(png(draw(size, fraction)))
        print(f"wrote {OUT / name}")
