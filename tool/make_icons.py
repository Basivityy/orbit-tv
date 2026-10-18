"""Generates the Orbit TV logo (PNG) and the Windows icon (.ico) — same mark as the in-app logo."""
import math
import sys
from PIL import Image, ImageDraw, ImageFilter

VIOLET = (124, 92, 255)
CYAN = (34, 211, 238)
WHITE = (242, 243, 250)
BG_TOP = (20, 23, 43)
BG_BOTTOM = (7, 8, 15)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def mark(size, background=True):
    s = size * 4  # supersample
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    if background:
        bg = Image.new("RGBA", (s, s))
        px = bg.load()
        for y in range(s):
            c = lerp(BG_TOP, BG_BOTTOM, y / (s - 1))
            for x in range(s):
                px[x, y] = c + (255,)
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=255)
        img.paste(bg, (0, 0), mask)
    cx = cy = s / 2
    r = s * (0.36 if background else 0.47)

    # Orbit ring: ellipse (r x 0.55r) rotated like the in-app mark, gradient violet -> cyan.
    ring = Image.new("L", (s, s), 0)
    w = int(r * 0.16)
    ImageDraw.Draw(ring).ellipse((cx - r, cy - r * 0.55, cx + r, cy + r * 0.55), outline=255, width=w)
    ring = ring.rotate(math.degrees(0.45), resample=Image.BICUBIC, center=(cx, cy))
    grad = Image.new("RGBA", (s, s))
    gp = grad.load()
    for x in range(s):
        c = lerp(VIOLET, CYAN, x / (s - 1))
        for y in range(s):
            gp[x, y] = c + (255,)
    img.paste(grad, (0, 0), ring)

    # Planet + satellite
    dd = ImageDraw.Draw(img)
    pr = r * 0.36
    dd.ellipse((cx - pr, cy - pr, cx + pr, cy + pr), fill=WHITE + (255,))
    sx, sy, sr = cx + r * 0.82, cy - r * 0.38, r * 0.14
    dd.ellipse((sx - sr, sy - sr, sx + sr, sy + sr), fill=CYAN + (255,))
    return img.resize((size, size), Image.LANCZOS)


def main(out_dir):
    mark(512).save(f"{out_dir}/assets/images/logo.png")
    mark(512, background=False).save(f"{out_dir}/assets/images/mark.png")
    big = mark(256)
    big.save(f"{out_dir}/installer/app_icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    big.save(f"{out_dir}/installer/app_icon.png")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
