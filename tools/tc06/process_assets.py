"""Preserve supplied branding and prepare faithful, reproducible surface labels."""
import argparse
import hashlib
import json
import shutil
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "static/lab/tc06"


def font(size):
    candidates = ["/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size=size)


def prepare(source):
    OUT.mkdir(parents=True, exist_ok=True)
    original = OUT / "logo-original.png"
    if source.resolve() != original.resolve():
        shutil.copy2(source, original)
    image = Image.open(original).convert("RGBA")
    # Remove only near-white pixels connected to the exterior. Interior white
    # eyes, whiskers, ears and lettering remain untouched inside the black badge.
    w, h = image.size
    pixels = image.load()
    queue = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    visited = set()
    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or not (0 <= x < w and 0 <= y < h):
            continue
        visited.add((x, y))
        r, g, b, a = pixels[x, y]
        if min(r, g, b) < 235 or a == 0:
            continue
        pixels[x, y] = (r, g, b, 0)
        queue.extend(((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)))
    image.save(OUT / "logo-badge.png", optimize=True)
    boot = Image.new("RGBA", (1024, 576), "#17242a")
    boot.alpha_composite(image.resize((384, 384), Image.Resampling.LANCZOS), (320, 32))
    ImageDraw.Draw(boot).text((512, 486), "TENSORCAT / RESEARCH CONSOLE", fill="#c8d9d5", font=font(36), anchor="mm")
    boot.save(OUT / "boot-screen.png", optimize=True)
    registry = json.loads((OUT / "experiments.json").read_text())
    for task in registry:
        label = Image.new("RGBA", (768, 840), task["color"])
        draw = ImageDraw.Draw(label)
        badge = image.resize((192, 192), Image.Resampling.LANCZOS)
        label.alpha_composite(badge, (40, 48))
        draw.text((290, 60), task["number"], fill="#26343b", font=font(160))
        draw.text((40, 350), task["label"], fill="#26343b", font=font(100))
        draw.text((40, 675), "TensorCat Lab", fill="#35444a", font=font(40))
        label.save(OUT / (task["id"] + "-label.png"), optimize=True)
    for name, text, size, dimensions in [("a", "A", 300, (768,384)), ("b", "B", 300, (768,384)), ("start", "START", 190, (1024,268)), ("select", "SELECT", 190, (1024,268)), ("off", "OFF", 160, (512,256)), ("on", "ON", 160, (512,256)), ("model", "TensorCat", 170, (1024,512)), ("wordmark", "TensorCat", 155, (1024,176))]:
        label = Image.new("RGBA", dimensions, (0, 0, 0, 0))
        draw = ImageDraw.Draw(label)
        color = "#f9f7f0" if name in ("a", "b", "start", "select") else "#26343b"
        draw.text((dimensions[0]/2, dimensions[1]/2), text, fill=color, font=font(size), anchor="mm")
        label.save(OUT / (name + "-label.png"), optimize=True)
    report = {"source_sha256": hashlib.sha256(original.read_bytes()).hexdigest(), "size": [w, h], "source_mode": Image.open(original).mode, "derived": "logo-badge.png", "operation": "Exterior-connected near-white removal only; original badge and internal artwork preserved."}
    (OUT / "branding.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", nargs="?", type=Path, default=OUT / "logo-original.png")
    prepare(parser.parse_args().source)
