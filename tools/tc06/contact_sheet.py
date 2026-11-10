"""Build an inspection sheet from the twelve offline CPU model renders."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
names = ["hero", "front", "rear", "left", "right", "top", "bottom", "buttons", "joystick", "slot", "logo", "cartridges"]
sheet = Image.new("RGB", (1200, 780), "#f7f9f9")
draw = ImageDraw.Draw(sheet)
for index, name in enumerate(names):
    x, y = index % 4 * 300, index // 4 * 260
    photo = Image.open(ROOT / "static/lab/tc06/previews" / (name + ".png"))
    photo.thumbnail((292, 225))
    sheet.paste(photo, (x + 4, y + 25))
    draw.text((x + 10, y + 6), name.upper(), fill="#263c43")
sheet.save(ROOT / "docs/lab-v3-model-sheet.jpg", quality=92)
