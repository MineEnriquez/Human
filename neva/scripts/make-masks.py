# Builds the line-art masks used by the site from the source images at the repo root:
#   ../images/otto.png          -> public/otto-mask.png  (Otto, the AI professor's avatar)
#   ../images/neva_and_owl.png  -> public/logo-mask.png  (site logo) + public/favicon.png
# Only the line art is kept (as alpha), so CSS can draw it in the theme's colour on any background.
# Run from neva/:  python3 scripts/make-masks.py
from PIL import Image, ImageDraw


def line_mask(path: str, size: int) -> Image.Image:
    src = Image.open(path).convert("RGBA")
    out = Image.new("RGBA", src.size)
    sp, op = src.load(), out.load()
    for y in range(src.height):
        for x in range(src.width):
            r, g, b, a = sp[x, y]
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            line = max(0, min(255, int((255 - lum) * 1.6)))  # dark lines -> opaque, white fill -> transparent
            op[x, y] = (0, 0, 0, int(line * a / 255))
    out = out.crop(out.getbbox())
    out.thumbnail((size, size), Image.LANCZOS)
    return out


otto = line_mask("../images/otto.png", 256)
otto.save("public/otto-mask.png", optimize=True)

logo = line_mask("../images/neva_and_owl.png", 256)
logo.save("public/logo-mask.png", optimize=True)

# Favicon: the logo in the theme yellow on the charcoal band colour.
S = 128
icon = Image.new("RGBA", (S, S), (0, 0, 0, 0))
ImageDraw.Draw(icon).rounded_rectangle([0, 0, S - 1, S - 1], radius=26, fill=(22, 22, 22, 255))
art = logo.copy()
art.thumbnail((S - 20, S - 20), Image.LANCZOS)
amber = Image.new("RGBA", art.size, (255, 194, 26, 255))
amber.putalpha(art.getchannel("A"))
icon.alpha_composite(amber, ((S - art.width) // 2, (S - art.height) // 2))
icon.save("public/favicon.png", optimize=True)
print("wrote otto-mask", otto.size, "logo-mask", logo.size, "favicon", icon.size)
