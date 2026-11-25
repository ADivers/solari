#!/usr/bin/env python3
"""Build the SOLARI Journal into <out>/blog/.

Every page is real, crawlable HTML first:
  blog/                     the index — published posts and arrivals
  blog/posts/<slug>/        one page per post (the canonical URL)
  blog/about/               about the journal
  blog/feed.xml             RSS 2.0
  blog/posts.json           machine-readable list of posts
journal.js then turns the page into a split-flap board, reading its text from the
same HTML. With JavaScript off, or in text mode, the HTML is the page.

Posts: blog/posts/*.md — front matter (title, date YYYY-MM-DD, tags, summary,
status: published | arriving) and a small Markdown subset (paragraphs, ## / ###,
> quotes, - lists, `code`, **bold**, *italic*, [links](url)).
"""
import html, json, math, re, shutil
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "blog"
SITE = "https://adivers.github.io/solari/"
BLOG = SITE + "blog/"
NAME = "SOLARI Journal"
TAGLINE = "A blog that is a split-flap departures board."


def parse(path):
    text = path.read_text()
    meta, body = {}, text
    m = re.match(r"---\n(.*?)\n---\n?(.*)", text, re.S)
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip()
        body = m.group(2)
    for key in ("title", "date", "summary"):
        if not meta.get(key):
            raise SystemExit(f"{path.name}: front matter is missing '{key}'")
    datetime.strptime(meta["date"], "%Y-%m-%d")  # fails loudly on a bad date
    words = len(re.findall(r"\w+", body))
    return {
        "slug": path.stem,
        "title": meta["title"],
        "date": meta["date"],
        "tags": [t.strip() for t in meta.get("tags", "").split(",") if t.strip()],
        "summary": meta["summary"],
        "status": meta.get("status", "published"),
        "minutes": max(1, math.ceil(words / 230)),
        "body": body.strip(),
    }


def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"`([^`]+)`", r"<code>\1</code>", s)
    s = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"\*([^*]+)\*", r"<em>\1</em>", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{html.escape(m.group(2))}">{m.group(1)}</a>', s)
    return s


def to_html(md):
    out, para, items = [], [], []

    def flush():
        nonlocal para, items
        if para:
            out.append("<p>" + inline(" ".join(para)) + "</p>")
            para = []
        if items:
            out.append("<ul>" + "".join("<li>" + inline(i) + "</li>" for i in items) + "</ul>")
            items = []

    for line in md.splitlines():
        s = line.strip()
        if not s:
            flush(); continue
        if s.startswith("### "):
            flush(); out.append("<h3>" + inline(s[4:]) + "</h3>")
        elif s.startswith("## "):
            flush(); out.append("<h2>" + inline(s[3:]) + "</h2>")
        elif s.startswith("> "):
            flush(); out.append("<blockquote><p>" + inline(s[2:]) + "</p></blockquote>")
        elif s.startswith("- "):
            if para: flush()
            items.append(s[2:])
        else:
            if items: flush()
            para.append(s)
    flush()
    return "\n".join(out)


def nice_date(d):
    return datetime.strptime(d, "%Y-%m-%d").strftime("%-d %B %Y")


def e(s):
    return html.escape(str(s), quote=True)


STYLE = """
  body{margin:0;background:var(--surface-000);color:var(--ink);font:18px/30px var(--font-sans);-webkit-font-smoothing:antialiased}
  .wrap{max-width:680px;margin:0 auto;padding:var(--space-8) var(--space-6) var(--space-16)}
  .top{display:flex;justify-content:space-between;align-items:center;gap:var(--space-4);flex-wrap:wrap;font:500 12px/16px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;margin-bottom:var(--space-12)}
  .top a{color:var(--ink-muted);text-decoration:none} .top a:hover,.top a[aria-current]{color:var(--ink)}
  .top nav{display:flex;gap:var(--space-4);flex-wrap:wrap;align-items:center}
  .brand{font:600 20px/1 var(--font-flap);letter-spacing:.06em;background:var(--solari-yellow);color:var(--on-yellow)!important;padding:4px 8px;border-radius:var(--radius-flap)}
  .meta{font:500 12px/16px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted)}
  h1{font:600 56px/56px var(--font-flap);letter-spacing:.01em;margin:var(--space-3) 0 var(--space-6);text-transform:uppercase}
  h2{font:600 30px/34px var(--font-flap);letter-spacing:.02em;text-transform:uppercase;margin:var(--space-12) 0 var(--space-3);color:var(--yellow-text)}
  h3{font-size:20px;line-height:28px;margin:var(--space-8) 0 var(--space-2)}
  p,ul,ol{margin:0 0 var(--space-6)}
  .lede{color:var(--ink-muted);font-size:20px;line-height:32px}
  blockquote{margin:var(--space-8) 0;padding:var(--space-4) var(--space-6);background:var(--housing);color:var(--flap-ink);border-radius:var(--radius-sm);font:600 26px/32px var(--font-flap);letter-spacing:.02em;text-transform:uppercase}
  blockquote p{margin:0}
  a{color:var(--yellow-text)}
  a:focus-visible,button:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
  code{font:15px var(--font-mono);background:var(--surface-200);padding:1px 4px;border-radius:2px}
  .posts{list-style:none;padding:0}
  .posts li{padding:var(--space-4) 0;border-top:1px solid var(--line)}
  .posts h3{margin:var(--space-1) 0;font:600 26px/30px var(--font-flap);letter-spacing:.02em;text-transform:uppercase}
  .posts h3 a{color:var(--ink);text-decoration:none} .posts h3 a:hover{color:var(--yellow-text)}
  .posts p{margin:0;color:var(--ink-muted)}
  .arriving h3{color:var(--ink-muted)}
  .mode{background:none;border:0;padding:0;font:inherit;letter-spacing:inherit;text-transform:inherit;color:var(--ink-muted);cursor:pointer}
  .mode:hover{color:var(--ink)}
  .foot{margin-top:var(--space-16);padding-top:var(--space-6);border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;font:500 12px/16px var(--font-mono);letter-spacing:.1em;text-transform:uppercase}
  .foot a{color:var(--ink-muted)}
  @media (max-width:560px){h1{font-size:42px;line-height:44px}}
  /* Board mode: the canvas is the page; this document stays for screen readers, search and copying. */
  #board{display:none}
  html.board,html.board body{background:var(--housing)}
  html.board body{overflow-x:hidden}
  html.board #board{display:block;touch-action:pan-y}
  html.board .doc{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  html.board .doc a:focus,html.board .doc button:focus{position:fixed;left:8px;top:8px;width:auto;height:auto;clip:auto;z-index:2;padding:6px 10px;background:var(--solari-yellow);color:var(--on-yellow);font:600 14px/20px var(--font-sans);text-transform:none;letter-spacing:0;outline:2px solid var(--flap-ink);border:0;white-space:nowrap}
"""

PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{description}">
<link rel="canonical" href="{url}">
<meta property="og:site_name" content="{name}">
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{og_title}">
<meta property="og:description" content="{description}">
<meta property="og:url" content="{url}">
<meta name="twitter:card" content="summary">
{extra_meta}<link rel="alternate" type="application/rss+xml" title="{name}" href="{root}feed.xml">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Crect width=%2716%27 height=%2716%27 rx=%272%27 fill=%27%231f1f1d%27/%3E%3Crect y=%277.5%27 width=%2716%27 height=%271%27 fill=%27%23050505%27/%3E%3Crect x=%275%27 y=%273%27 width=%276%27 height=%2710%27 fill=%27%23f5c400%27/%3E%3C/svg%3E">
<link rel="preload" href="{root}../fonts/BarlowCondensed-SemiBold-subset.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{root}../tokens.css">
<script>
  // Board unless the reader chose text (?text, or the toggle). Decided before first paint.
  (function () {{
    var text = /[?&]text\\b/.test(location.search), m;
    try {{ m = localStorage.getItem("solari-journal-mode"); if (text) localStorage.setItem("solari-journal-mode", "text"); }} catch (e) {{}}
    if (!text && m !== "text" && window.HTMLCanvasElement) document.documentElement.classList.add("board");
  }})();
</script>
<style>{style}</style>
</head>
<body data-page="{kind}" data-root="{root}">
<canvas id="board" aria-hidden="true"></canvas>
<div class="doc">
<div class="wrap">
  <header class="top">
    <a class="brand" href="{root}" aria-label="{name} home">SOLARI</a>
    <nav aria-label="Journal">
      <a href="{root}"{cur_posts}>Posts</a>
      <a href="{root}about/"{cur_about}>About</a>
      <a href="{root}feed.xml">RSS</a>
      <button type="button" class="mode" data-mode-toggle>Read on the board</button>
    </nav>
  </header>
{main}
</div>
</div>
<script src="{root}../engine/solari-board.js" defer></script>
<script src="{root}journal.js" defer></script>
</body>
</html>
"""


def page(kind, root, title, description, url, main, og_type="website", og_title=None, extra_meta=""):
    return PAGE.format(kind=kind, root=root, title=e(title), description=e(description), url=e(url), name=NAME,
                       og_type=og_type, og_title=e(og_title or title), extra_meta=extra_meta, style=STYLE, main=main,
                       cur_posts=' aria-current="page"' if kind == "index" else "",
                       cur_about=' aria-current="page"' if kind == "about" else "")


def build(out_root):
    out = out_root / "blog"
    if out.exists():
        shutil.rmtree(out)
    (out / "posts").mkdir(parents=True)
    shutil.copy(SRC / "journal.js", out / "journal.js")

    posts = [parse(p) for p in sorted((SRC / "posts").glob("*.md"))]
    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    live = [p for p in posts if p["status"] != "arriving"]
    arriving = sorted([p for p in posts if p["status"] == "arriving"], key=lambda p: p["date"])
    (out / "posts.json").write_text(json.dumps({"posts": [
        {**{k: v for k, v in p.items() if k != "body"}, "url": BLOG + "posts/" + p["slug"] + "/"} for p in live
    ] + [{k: v for k, v in p.items() if k != "body"} for p in arriving]}, indent=1))

    # Index
    li = []
    for p in live:
        li.append(f"""    <li data-slug="{e(p['slug'])}" data-date="{p['date']}" data-minutes="{p['minutes']}" data-status="published">
      <div class="meta"><time datetime="{p['date']}">{nice_date(p['date'])}</time> · {p['minutes']} min</div>
      <h3><a href="posts/{e(p['slug'])}/">{e(p['title'])}</a></h3>
      <p>{e(p['summary'])}</p>
    </li>""")
    arr = []
    for p in arriving:
        arr.append(f"""    <li data-slug="{e(p['slug'])}" data-date="{p['date']}" data-status="arriving">
      <div class="meta">Expected <time datetime="{p['date']}">{nice_date(p['date'])}</time></div>
      <h3>{e(p['title'])}</h3>
      <p>{e(p['summary'])}</p>
    </li>""")
    main = f"""  <main>
    <h1>{NAME}</h1>
    <p class="lede">{TAGLINE} Posts are trains; opening one flips the board through it a screen at a time.</p>
    <h2>Departures</h2>
    <ol class="posts" data-list="departures">
{chr(10).join(li)}
    </ol>
""" + (f"""    <h2>Arrivals</h2>
    <ol class="posts arriving" data-list="arrivals">
{chr(10).join(arr)}
    </ol>
""" if arr else "") + "  </main>"
    ld = {"@context": "https://schema.org", "@type": "Blog", "name": NAME, "url": BLOG, "description": TAGLINE,
          "blogPost": [{"@type": "BlogPosting", "headline": p["title"], "datePublished": p["date"], "url": BLOG + "posts/" + p["slug"] + "/"} for p in live]}
    (out / "index.html").write_text(page("index", "", NAME + " — a blog on a departures board", TAGLINE, BLOG, main,
        extra_meta=f'<script type="application/ld+json">{json.dumps(ld)}</script>\n'))

    # Posts
    for i, p in enumerate(live):
        newer = live[i - 1] if i > 0 else None
        older = live[i + 1] if i + 1 < len(live) else None
        url = BLOG + "posts/" + p["slug"] + "/"
        prev = f'<a href="../{older["slug"]}/" rel="prev">&larr; {e(older["title"])}</a>' if older else "<span></span>"
        nxt = f'<a href="../{newer["slug"]}/" rel="next">{e(newer["title"])} &rarr;</a>' if newer else "<span></span>"
        main = f"""  <main>
    <article data-slug="{e(p['slug'])}" data-date="{p['date']}" data-minutes="{p['minutes']}" data-tags="{e(', '.join(p['tags']))}">
      <div class="meta"><time datetime="{p['date']}">{nice_date(p['date'])}</time> · {p['minutes']} min read{''.join(' · ' + e(t) for t in p['tags'])}</div>
      <h1>{e(p['title'])}</h1>
      <p class="lede">{e(p['summary'])}</p>
      <div class="body">
{to_html(p['body'])}
      </div>
    </article>
    <nav class="foot" aria-label="More posts">{prev}{nxt}</nav>
  </main>"""
        ld = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": p["title"], "description": p["summary"],
              "datePublished": p["date"], "url": url, "mainEntityOfPage": url, "keywords": ", ".join(p["tags"]),
              "isPartOf": {"@type": "Blog", "name": NAME, "url": BLOG}}
        extra = (f'<meta property="article:published_time" content="{p["date"]}">\n'
                 + "".join(f'<meta property="article:tag" content="{e(t)}">\n' for t in p["tags"])
                 + f'<script type="application/ld+json">{json.dumps(ld)}</script>\n')
        d = out / "posts" / p["slug"]
        d.mkdir(parents=True)
        (d / "index.html").write_text(page("post", "../../", p["title"] + " — " + NAME, p["summary"], url, main,
                                           og_type="article", og_title=p["title"], extra_meta=extra))

    # About
    main = """  <main>
    <h1>About the journal</h1>
    <p class="lede">This blog is a split-flap departures board. Posts are trains: the date they left, where they go, how long the trip takes.</p>
    <p>Open one and the board flips through it a screen at a time. Arrow keys or a swipe turn the page, and AUTO turns them for you at reading pace.</p>
    <p>Every post is also an ordinary web page like this one, and there is an RSS feed.</p>
    <ul>
      <li><a href="../">All posts</a></li>
      <li><a href="../posts/one-canvas/">How the board works</a></li>
      <li><a href="https://github.com/ADivers/solari">Source on GitHub</a></li>
    </ul>
  </main>"""
    (out / "about").mkdir()
    (out / "about" / "index.html").write_text(page("about", "../", "About — " + NAME, TAGLINE, BLOG + "about/", main))

    # RSS
    items = []
    for p in live:
        dt = datetime.strptime(p["date"], "%Y-%m-%d").replace(hour=12, tzinfo=timezone.utc)
        link = BLOG + "posts/" + p["slug"] + "/"
        items.append(f"""  <item>
    <title>{html.escape(p['title'])}</title>
    <link>{link}</link>
    <guid isPermaLink="true">{link}</guid>
    <pubDate>{format_datetime(dt)}</pubDate>
    <description>{html.escape(p['summary'])}</description>
    <content:encoded><![CDATA[{to_html(p['body'])}]]></content:encoded>
  </item>""")
    (out / "feed.xml").write_text(f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>{NAME}</title>
  <link>{BLOG}</link>
  <atom:link href="{BLOG}feed.xml" rel="self" type="application/rss+xml"/>
  <description>{TAGLINE}</description>
  <language>en</language>
{chr(10).join(items)}
</channel>
</rss>
""")
    return [(BLOG, live[0]["date"] if live else None), (BLOG + "about/", None)] + \
           [(BLOG + "posts/" + p["slug"] + "/", p["date"]) for p in live]


if __name__ == "__main__":
    print(build(ROOT / "_site"))
