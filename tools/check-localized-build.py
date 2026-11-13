"""Validate explicit locale bindings in the actual Zola output."""
import json
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MESSAGES = json.loads((ROOT / "data/locales.json").read_text())


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.preferences = Counter()
        self.unknown = set()
        self.order = []
        self.template_depth = 0

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "template":
            self.template_depth += 1
        if attrs.get("id") and not self.template_depth:
            self.ids.append(attrs["id"])
        if attrs.get("data-preference"):
            self.preferences[attrs["data-preference"]] += 1
        for name, key in attributes:
            if name in {"data-i18n", "data-i18n-aria-label", "data-i18n-title", "data-i18n-content", "data-i18n-alt"} and key not in MESSAGES:
                self.unknown.add(key)
        if tag == "script" and attrs.get("src", "").endswith("preferences-init.js"):
            self.order.append("init")
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.order.append("style")

    def handle_endtag(self, tag):
        if tag == "template":
            self.template_depth -= 1


paths = sorted((ROOT / "public").rglob("*.html"))
assert paths, "Run zola build first"
for path in paths:
    page = Page()
    page.feed(path.read_text())
    assert not page.unknown, (path, page.unknown)
    assert page.preferences == {"language": 1, "theme": 1}, (path, page.preferences)
    assert page.order[0] == "init", (path, page.order)
    duplicates = [key for key, count in Counter(page.ids).items() if count > 1]
    assert not duplicates, (path, duplicates)
print(f"Validated locale bindings, unique IDs, early initialization and controls in {len(paths)} built pages.")
