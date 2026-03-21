"""
Remove black/near-black fills and dark speckles from logo PNGs while keeping
colorful edges (rainbow wireframe) and medium-brightness grey text.

Not edge-only flood fill: also clears *interior* black faces inside wireframes.
"""
from __future__ import print_function
import sys

try:
    from PIL import Image
except ImportError:
    print("PIL/Pillow required: pip install pillow", file=sys.stderr)
    sys.exit(1)


def keep_opaque_rgb(r, g, b):
    """Keep colorful edges + anti-aliased text; drop flat black/gray fills and specks."""
    mx = max(r, g, b)
    mn = min(r, g, b)
    sat = mx - mn
    # Rainbow / wireframe color
    if sat >= 20:
        return True
    # Likely text (uneven greys from rendering / AA)
    if mx >= 68 and sat >= 4:
        return True
    if mx >= 58 and sat >= 12:
        return True
    # Flat dark/mid fills: cube faces, outer black, bottom junk
    return False


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    dst = sys.argv[2] if len(sys.argv) > 2 else None
    if not src or not dst:
        print("usage: logo-remove-black-bg.py <in.png> <out.png>", file=sys.stderr)
        sys.exit(1)

    img = Image.open(src).convert("RGBA")
    px = img.load()
    w, h = img.size

    for yy in range(h):
        for xx in range(w):
            r, g, b, a = px[xx, yy]
            if a == 0:
                continue
            if not keep_opaque_rgb(r, g, b):
                px[xx, yy] = (0, 0, 0, 0)

    # Remove isolated 1px noise (optional cleanup)
    neighbors = ((-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1))
    for yy in range(1, h - 1):
        for xx in range(1, w - 1):
            r, g, b, a = px[xx, yy]
            if a == 0:
                continue
            n_opaque = 0
            for dx, dy in neighbors:
                _, _, _, na = px[xx + dx, yy + dy]
                if na > 0:
                    n_opaque += 1
            if n_opaque <= 1 and max(r, g, b) < 72:
                px[xx, yy] = (0, 0, 0, 0)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    img.save(dst, "PNG")
    print("wrote", dst, "size", img.size)


if __name__ == "__main__":
    main()
