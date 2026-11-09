from PIL import Image, ImageDraw
import os

S = 1024
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "icons")
os.makedirs(OUT, exist_ok=True)

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

top = (108, 84, 255)
mid = (77, 141, 255)
bot = (255, 150, 110)

grad = Image.new("RGBA", (S, S))
gd = ImageDraw.Draw(grad)
for y in range(S):
    t = y / (S - 1)
    if t < 0.58:
        c = lerp(top, mid, t / 0.58)
    else:
        c = lerp(mid, bot, (t - 0.58) / 0.42)
    gd.line([(0, y), (S, y)], fill=c + (255,))

mask = Image.new("L", (S, S), 0)
md = ImageDraw.Draw(mask)
md.rounded_rectangle([0, 0, S - 1, S - 1], radius=228, fill=255)

img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
img.paste(grad, (0, 0), mask)

# 顶部柔光
hl = Image.new("RGBA", (S, S), (0, 0, 0, 0))
hd = ImageDraw.Draw(hl)
hd.ellipse([-260, -640, S + 260, 400], fill=(255, 255, 255, 54))
hl = Image.composite(hl, Image.new("RGBA", (S, S), (0, 0, 0, 0)), mask)
img = Image.alpha_composite(img, hl)

d = ImageDraw.Draw(img)
d.rounded_rectangle([9, 9, S - 10, S - 10], radius=220, outline=(255, 255, 255, 120), width=5)

white = (255, 255, 255, 255)
w = 62
d.line([(330, 292), (512, 556)], fill=white, width=w)
d.line([(694, 292), (512, 556)], fill=white, width=w)
d.line([(512, 540), (512, 752)], fill=white, width=w)
d.line([(392, 606), (632, 606)], fill=white, width=w)
d.line([(392, 696), (632, 696)], fill=white, width=w)
for p in [(330, 292), (694, 292), (512, 752)]:
    r = w // 2
    d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=white)

img.save(os.path.join(OUT, "icon.png"))
img.resize((128, 128), Image.LANCZOS).save(os.path.join(OUT, "128x128.png"))
img.resize((32, 32), Image.LANCZOS).save(os.path.join(OUT, "32x32.png"))
img.resize((256, 256), Image.LANCZOS).save(
    os.path.join(OUT, "icon.ico"),
    sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)],
)
print("icons ok:", os.listdir(OUT))
