"""Vibe Account icon 鈥?DSH-style premium minimal mark.

White squircle + deep ink "V" monogram, soft shadow and a quiet specular sweep.
Rendered at 4x and downsampled for clean edges.
"""
from PIL import Image, ImageDraw, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "src-tauri", "icons")
S = 4096
M = 72                      # margin inside canvas
R = 900                     # squircle radius
BOX = (M, M, S - M, S - M)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def vertical_gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", (1, h))
    px = img.load()
    for y in range(h):
        px[0, y] = lerp(top, bottom, y / max(1, h - 1))
    return img.resize((w, h), Image.BICUBIC)


def squircle_mask(size, box, radius):
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle(box, radius=radius, fill=255)
    return mask


canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))

# --- soft outer shadow ---
shadow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
sd = ImageDraw.Draw(shadow)
sd.rounded_rectangle(
    (BOX[0], BOX[1] + 36, BOX[2], BOX[3] + 36), radius=R, fill=(18, 22, 34, 70)
)
shadow = shadow.filter(ImageFilter.GaussianBlur(70))
canvas = Image.alpha_composite(canvas, shadow)

# --- squircle body ---
mask = squircle_mask(S, BOX, R)
body = vertical_gradient((S, S), (253, 253, 254), (232, 235, 241)).convert("RGBA")
canvas.paste(body, (0, 0), mask)

# --- interior soft shading (top light, bottom cool) ---
shade = Image.new("RGBA", (S, S), (0, 0, 0, 0))
gd = ImageDraw.Draw(shade)
gd.ellipse((-S * 0.25, -S * 0.55, S * 1.25, S * 0.55), fill=(255, 255, 255, 46))
shade = shade.filter(ImageFilter.GaussianBlur(280))
canvas = Image.alpha_composite(canvas, Image.composite(shade, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))

# --- hairline inner border ---
border = Image.new("RGBA", (S, S), (0, 0, 0, 0))
bd = ImageDraw.Draw(border)
bd.rounded_rectangle(BOX, radius=R, outline=(24, 28, 44, 34), width=6)
canvas = Image.alpha_composite(canvas, Image.composite(border, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))

# --- monogram V ---
glyph_mask = Image.new("L", (S, S), 0)
gmd = ImageDraw.Draw(glyph_mask)
pts = [(1250, 1330), (2048, 2760), (2846, 1330)]
gmd.line(pts, fill=255, width=392, joint="curve")
for x, y in (pts[0], pts[-1]):
    gmd.ellipse((x - 196, y - 196, x + 196, y + 196), fill=255)
gmd.ellipse((2048 - 196, 2760 - 196, 2048 + 196, 2760 + 196), fill=255)

# glyph gradient fill
ink = vertical_gradient((S, S), (24, 29, 43), (48, 56, 76)).convert("RGBA")
canvas = Image.alpha_composite(canvas, Image.composite(ink, Image.new("RGBA", (S, S), (0, 0, 0, 0)), glyph_mask))

# --- soft specular bloom in the upper-left of the glass ---
sweep = Image.new("RGBA", (S, S), (0, 0, 0, 0))
swd = ImageDraw.Draw(sweep)
swd.ellipse((S * 0.02, S * 0.00, S * 0.62, S * 0.40), fill=(255, 255, 255, 60))
sweep = sweep.filter(ImageFilter.GaussianBlur(160))
canvas = Image.alpha_composite(canvas, Image.composite(sweep, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask))

# downscale
icon = canvas.resize((1024, 1024), Image.LANCZOS)
os.makedirs(OUT, exist_ok=True)
icon.save(os.path.join(OUT, "icon.png"))
for size in (32, 48, 128, 256):
    icon.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f"{size}x{size}.png"))

icon.resize((256, 256), Image.LANCZOS).save(
    os.path.join(OUT, "icon.ico"),
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("icons written to", os.path.abspath(OUT))

