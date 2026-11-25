#!/usr/bin/env python3
"""Fail if any page in the built site links to a local file that does not exist.

Usage: python3 tools/check_links.py _site
Checks href/src in every .html file, the URLs in sitemap.xml and the links in blog/feed.xml.
External links (http/https to other hosts), mailto: and in-page #anchors are skipped.
"""
import re, sys
from pathlib import Path
from urllib.parse import urlparse, unquote

SITE_PREFIX = "https://adivers.github.io/solari/"


def resolve(root, page, ref):
    ref = ref.split("#", 1)[0].split("?", 1)[0]
    if not ref:
        return None
    if ref.startswith(SITE_PREFIX):
        target = root / unquote(ref[len(SITE_PREFIX):])
    elif urlparse(ref).scheme or ref.startswith("//"):
        return None
    elif ref.startswith("/"):
        target = root / unquote(ref.lstrip("/"))
    else:
        target = (page.parent / unquote(ref))
    target = target.resolve()
    if target.is_dir():
        target = target / "index.html"
    return target


def main(root):
    root = Path(root).resolve()
    bad, checked = [], 0
    pages = list(root.rglob("*.html"))
    for page in pages:
        text = page.read_text(errors="ignore")
        for ref in re.findall(r'(?:href|src)="([^"]+)"', text):
            if ref.startswith(("mailto:", "data:", "javascript:")):
                continue
            t = resolve(root, page, ref)
            if t is None:
                continue
            checked += 1
            if not t.exists() or root not in t.parents and t != root:
                bad.append(f"{page.relative_to(root)} -> {ref}")
    for xml in (root / "sitemap.xml", root / "blog" / "feed.xml"):
        if xml.exists():
            for ref in re.findall(r"<(?:loc|link)>([^<]+)</(?:loc|link)>", xml.read_text()):
                t = resolve(root, xml, ref)
                if t is not None:
                    checked += 1
                    if not t.exists():
                        bad.append(f"{xml.relative_to(root)} -> {ref}")
    print(f"checked {checked} local links across {len(pages)} pages")
    if bad:
        print("broken links:\n  " + "\n  ".join(bad))
        sys.exit(1)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "_site")
