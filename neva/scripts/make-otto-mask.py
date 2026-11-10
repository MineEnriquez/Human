# Builds public/otto-mask.png (Professor Neva's avatar) from images/otto.png at the repo root.
# Keeps only the owl's line art as alpha, so CSS can draw it in the theme's colour on any background.
# Run from neva/:  python3 scripts/make-otto-mask.py
from PIL import Image

src = Image.open("../images/otto.png").convert("RGBA")
out = Image.new("RGBA", src.size)
sp, op = src.load(), out.load()
for y in range(src.height):
    for x in range(src.width):
        r, g, b, a = sp[x, y]
        lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
        line = max(0, min(255, int((255 - lum) * 1.6)))  # dark lines -> opaque, white fill -> transparent
        op[x, y] = (0, 0, 0, int(line * a / 255))
out = out.crop(out.getbbox())
out.thumbnail((256, 256), Image.LANCZOS)
out.save("public/otto-mask.png", optimize=True)
print("wrote public/otto-mask.png", out.size)
