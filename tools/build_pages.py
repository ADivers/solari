#!/usr/bin/env python3
"""Build the GitHub Pages site into docs/.

- docs/index.html            the Solari board website theme (components/Homepage)
- docs/system/index.html     a gallery of every component
- docs/components/<Name>/    each preview as a standalone page
- docs/tokens.css            generated from tokens.json (Station on :root, Daylight on [data-theme="daylight"])

Run from the repo root:  python3 tools/build_pages.py
"""
import json, re, shutil, html, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(os.environ.get("SOLARI_OUT", ROOT / "_site"))
REACT = ["vendor/react.production.min.js", "vendor/react-dom.production.min.js"]  # React 18.3.1, vendored
FIRST, SECOND = "station", "daylight"


def tokens_css():
    t = json.loads((ROOT / "tokens.json").read_text())
    names = {tok["name"] for tok in t["color"]["tokens"]}

    def val(v):
        m = re.fullmatch(r"\{([A-Za-z0-9_.-]+)\}", v)
        return f"var(--{m.group(1)})" if m and m.group(1) in names else v

    first, second, shared = [], [], []
    for tok in t["color"]["tokens"]:
        v = tok["value"]
        if isinstance(v, dict):
            first.append(f"  --{tok['name']}: {val(v[FIRST])};")
            if SECOND in v:
                second.append(f"  --{tok['name']}: {val(v[SECOND])};")
        else:
            first.append(f"  --{tok['name']}: {val(v)};")
    for fam, stack in t["type"]["families"].items():
        shared.append(f"  --font-{fam}: {stack};")
    for key, fam in t.items():
        if key in ("name", "version", "color", "type") or not isinstance(fam, dict):
            continue
        for tok in fam.get("tokens", []):
            shared.append(f"  --{tok['name']}: {tok['value']};")
    faces = ""
    for f in t["type"].get("fonts", []):
        faces += (f"@font-face {{ font-family: \"{f['family']}\"; src: url(\"{f['file']}\") format(\"woff2\"); "
                  f"font-weight: {f.get('weight', '400')}; font-style: {f.get('style', 'normal')}; font-display: swap; }}\n")
    return (
        "/* SOLARI — generated from tokens.json by tools/build_pages.py. Do not edit. */\n" + faces +
        f":root, [data-theme=\"{FIRST}\"] {{\n  color-scheme: dark;\n" + "\n".join(first) + "\n}\n"
        f"[data-theme=\"{SECOND}\"] {{\n  color-scheme: light;\n" + "\n".join(second) + "\n}\n"
        ":root {\n" + "\n".join(shared) + "\n}\n"
    )


ICON = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Crect width=%2716%27 height=%2716%27 rx=%272%27 fill=%27%231f1f1d%27/%3E%3Crect y=%277.5%27 width=%2716%27 height=%271%27 fill=%27%23050505%27/%3E%3Crect x=%275%27 y=%273%27 width=%276%27 height=%2710%27 fill=%27%23f5c400%27/%3E%3C/svg%3E"

HEAD = """<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="{icon}">
<link rel="preload" href="{up}fonts/BarlowCondensed-SemiBold-subset.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{up}tokens.css">
<link rel="stylesheet" href="{up}components/bundle.css">
<script src="{up}{r0}"></script>
<script src="{up}{r1}"></script>
<script src="{up}components/bundle.js"></script>
"""

THEME = """<script>
(function(){
  var k='sl-theme',t;try{t=localStorage.getItem(k)}catch(e){}
  if(t)document.documentElement.setAttribute('data-theme',t);
  window.slToggleTheme=function(){
    var n=document.documentElement.getAttribute('data-theme')==='daylight'?'station':'daylight';
    document.documentElement.setAttribute('data-theme',n);try{localStorage.setItem(k,n)}catch(e){}
    document.querySelectorAll('iframe').forEach(function(f){try{f.contentDocument.documentElement.setAttribute('data-theme',n)}catch(e){}});
  };
})();
</script>
"""

THEME_BUTTON = """<button type="button" class="sl-btn sl-btn--ghost sl-btn--sm sl-themebtn" onclick="slToggleTheme()">Theme</button>
<script>if(window.self!==window.top){var b=document.querySelector('.sl-themebtn');if(b)b.remove();}</script>
<style>.sl-themebtn{position:fixed;right:16px;bottom:16px;z-index:50;background:var(--surface-100);border:1px solid var(--line-strong)}</style>
"""


def head(up):
    return HEAD.format(up=up, r0=REACT[0], r1=REACT[1], icon=ICON) + THEME


def card_meta(src):
    m = re.match(r"\s*<!--\s*@dsCard(.*?)-->", src)
    meta = {}
    if m:
        for k, v in re.findall(r'(\w+)=("[^"]*"|\S+)', m.group(1)):
            meta[k] = v.strip('"')
    return meta


def standalone(src, up, extra_body=""):
    src = re.sub(r"^\s*<!--\s*@dsCard.*?-->\s*", "", src, flags=re.S)
    src = src.replace("<html>", '<html lang="en">', 1)
    src = src.replace("</title>", "</title>\n" + head(up), 1)
    if extra_body:
        src = src.replace("</body>", extra_body + "</body>", 1)
    return src


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "components").mkdir(parents=True)
    (OUT / "tokens.css").write_text(tokens_css())
    for f in ("bundle.css", "bundle.js", "index.d.ts"):
        shutil.copy(ROOT / "components" / f, OUT / "components" / f)
    shutil.copy(ROOT / "tokens.json", OUT / "tokens.json")
    shutil.copytree(ROOT / "vendor", OUT / "vendor")
    shutil.copytree(ROOT / "fonts", OUT / "fonts")
    (OUT / ".nojekyll").write_text("")
    # Experiments: standalone pages copied as-is (they link ../tokens.css).
    for exp in sorted(p for p in (ROOT / "experiments").iterdir() if p.is_dir()):
        shutil.copytree(exp, OUT / exp.name)
    # The board blog (docs/blog/): app, posts.json, RSS feed, text versions.
    import build_blog
    urls = build_blog.build(OUT)
    # Sitemap for the whole project site.
    site = "https://adivers.github.io/solari/"
    urls = [(site, None), (site + "system/", None), (site + "board/", None)] + urls
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u, d in urls:
        sm.append(f"  <url><loc>{u}</loc>" + (f"<lastmod>{d}</lastmod>" if d else "") + "</url>")
    sm.append("</urlset>")
    (OUT / "sitemap.xml").write_text("\n".join(sm) + "\n")
    # (robots.txt only counts at the host root, adivers.github.io/robots.txt — submit the sitemap in Search Console instead.)

    pages = []
    for prev in sorted((ROOT / "components").glob("*/preview.html")):
        name = prev.parent.name
        if name == "Cover":
            continue
        src = prev.read_text()
        meta = card_meta(src)
        dest = OUT / "components" / name / "index.html"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(standalone(src, "../../", THEME_BUTTON))
        pages.append((name, meta))

    # The website theme is the site's front page.
    home = (ROOT / "components" / "Homepage" / "preview.html").read_text()
    home = home.replace("'© 2026 SOLARI. Set in Barlow Condensed and your system font.'",
                        "'© 2026 SOLARI · ', h('a', { href: 'system/' }, 'Design system'), ' · ', h('a', { href: 'board/' }, 'The whole page is a board'), ' · ', h('a', { href: 'blog/' }, 'Journal'), ' · ', h('a', { href: 'https://github.com/ADivers/solari' }, 'Source on GitHub')")
    home = home.replace("<title>SOLARI — website theme</title>", "<title>SOLARI — a Solari board website theme</title>\n<meta name=\"description\" content=\"SOLARI: a split-flap departures-board website theme and design system.\">\n<link rel=\"canonical\" href=\"https://adivers.github.io/solari/\">\n<meta property=\"og:title\" content=\"SOLARI — a Solari board website theme\">\n<meta property=\"og:description\" content=\"A split-flap departures-board website theme and design system.\">\n<meta property=\"og:url\" content=\"https://adivers.github.io/solari/\">\n<meta property=\"og:type\" content=\"website\">")
    (OUT / "index.html").write_text(standalone(home, "", THEME_BUTTON))

    order = ["SplitFlap", "DepartureBoard", "Clock", "Button", "NavBar", "Panel", "StatusFlap", "Homepage"]
    pages.sort(key=lambda p: order.index(p[0]) if p[0] in order else 99)
    cards = []
    for name, meta in pages:
        is_page = name == "Homepage"
        hgt = 520 if is_page else max(300, min(int(meta.get("height", 200)) + 40, 420))
        wide = is_page or name in ("SplitFlap", "DepartureBoard", "Panel")
        sub = html.escape(meta.get("subtitle", "Component"))
        cards.append(f"""      <article class="card{' wide' if wide else ''}">
        <div class="card-head"><span class="sl-label">{html.escape(meta.get('group', 'Component'))}</span>
          <a class="open" href="../components/{name}/">Open {html.escape(name)} &rarr;</a></div>
        <h2>{html.escape(name)}</h2><p class="sub">{sub}</p>
        <iframe src="../components/{name}/" title="{html.escape(name)} preview" loading="lazy" style="height:{hgt}px"></iframe>
      </article>""")

    gallery = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>SOLARI — design system</title>
<meta name="description" content="SOLARI: a split-flap departures-board design system — tokens, components and a website theme.">
<link rel="canonical" href="https://adivers.github.io/solari/system/">
{head('../')}<style>
  body{{margin:0}}
  .pg{{max-width:1104px;margin:0 auto;padding:0 var(--space-6)}}
  .hero{{padding:var(--space-8) 0 var(--space-12)}}
  .hero p{{font-size:18px;line-height:28px;color:var(--ink-muted);max-width:60ch;margin:var(--space-6) 0}}
  .ctas{{display:flex;gap:var(--space-3);flex-wrap:wrap}}
  .grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr));gap:var(--space-6);padding-bottom:var(--space-16)}}
  .card{{background:var(--surface-100);border:1px solid var(--line);border-radius:var(--radius-sm);padding:var(--space-6);min-width:0}}
  .card.wide{{grid-column:1/-1}}
  .card-head{{display:flex;justify-content:space-between;gap:var(--space-4)}}
  .card h2{{margin:var(--space-3) 0 0;font-size:20px;line-height:28px}}
  .sub{{margin:var(--space-1) 0 var(--space-4);color:var(--ink-muted);font-size:14px}}
  .open{{color:var(--yellow-text);font-size:14px;text-decoration:none}}
  .open:hover,.open:focus-visible{{text-decoration:underline}}
  iframe{{display:block;width:100%;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--surface-000)}}
  footer{{padding:var(--space-8) 0;color:var(--ink-muted);font-size:14px;border-top:1px solid var(--line)}}
  footer a{{color:var(--ink)}}
</style>
</head>
<body class="sl-root">
<div class="pg">
  <div id="nav"></div>
  <section class="hero">
    <div id="board"></div>
    <p>SOLARI is a website design system modelled on the split-flap departures board: flaps that step through their drum one character at a time, black housing, white information, yellow signal. These are its components; the <a href="../" style="color:var(--yellow-text)">website theme</a> puts them together.</p>
    <div id="ctas" class="ctas"></div>
  </section>
  <main class="grid">
{chr(10).join(cards)}
  </main>
  <footer>SOLARI design system &middot; <a href="https://github.com/ADivers/solari">Source on GitHub</a> &middot; <a href="../tokens.json">tokens.json</a></footer>
</div>
{THEME_BUTTON}<script>
  var S = window.Solari, h = React.createElement;
  ReactDOM.createRoot(document.getElementById('nav')).render(h(S.NavBar, {{ brand: 'SOLARI', brandHref: '../',
    links: [{{ label: 'Theme', href: '../' }}, {{ label: 'Components', href: './', active: true }}, {{ label: 'Source', href: 'https://github.com/ADivers/solari' }}] }}));
  ReactDOM.createRoot(document.getElementById('board')).render(h(S.SplitFlap, {{ messages: ['DESIGN SYSTEM', 'SPLIT FLAP', 'ON TIME'], length: 13, fit: true, maxHeight: 80, color: 'yellow', label: 'SOLARI design system' }}));
  ReactDOM.createRoot(document.getElementById('ctas')).render(h(React.Fragment, null,
    h(S.Button, {{ href: '../', arrow: true }}, 'See the website theme'),
    h(S.Button, {{ variant: 'secondary', href: '../board/' }}, 'The whole page is a board'),
    h(S.Button, {{ variant: 'secondary', href: '../blog/' }}, 'The board blog'),
    h(S.Button, {{ variant: 'secondary', href: 'https://github.com/ADivers/solari' }}, 'View source')));
</script>
</body>
</html>
"""
    (OUT / "system").mkdir()
    (OUT / "system" / "index.html").write_text(gallery)
    print(f"Built theme + {len(pages)} component pages into {OUT}")


if __name__ == "__main__":
    build()
