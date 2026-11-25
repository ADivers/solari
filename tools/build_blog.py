#!/usr/bin/env python3
"""Build the board blog into docs/blog/.

Reads blog/posts/*.md (front matter + a small Markdown subset) and writes:
  docs/blog/index.html            the board app (copied from blog/index.html)
  docs/blog/posts.json            every post, newest first, with its Markdown body
  docs/blog/feed.xml              RSS 2.0 of published posts
  docs/blog/posts/<slug>/         a plain-text (normal HTML) version of each post

Front matter keys: title, date (YYYY-MM-DD), tags (comma list), summary, status (published | arriving).
Markdown: paragraphs, ## and ### headings, > quotes, - lists, `code`, **bold**, *italic*, [links](url).
"""
import html, json, math, re, shutil
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "blog"
SITE = "https://adivers.github.io/solari/blog/"


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
    words = len(re.findall(r"\w+", body))
    return {
        "slug": path.stem,
        "title": meta.get("title", path.stem),
        "date": meta.get("date", "1970-01-01"),
        "tags": [t.strip() for t in meta.get("tags", "").split(",") if t.strip()],
        "summary": meta.get("summary", ""),
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


TEXT_PAGE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title} — SOLARI Journal</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="{summary}">
<link rel="alternate" type="application/rss+xml" title="SOLARI Journal" href="../../feed.xml">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600&display=swap">
<link rel="stylesheet" href="../../../tokens.css">
<script>try{{var t=localStorage.getItem('sl-theme');if(t)document.documentElement.setAttribute('data-theme',t)}}catch(e){{}}</script>
<style>
  body{{margin:0;background:var(--surface-000);color:var(--ink);font:18px/30px var(--font-sans);-webkit-font-smoothing:antialiased}}
  .wrap{{max-width:680px;margin:0 auto;padding:var(--space-8) var(--space-6) var(--space-16)}}
  .top{{display:flex;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;font:500 12px/16px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;margin-bottom:var(--space-12)}}
  .top a{{color:var(--ink-muted);text-decoration:none}} .top a:hover{{color:var(--ink)}}
  .brand{{font:600 20px/1 var(--font-flap);letter-spacing:.06em;background:var(--solari-yellow);color:var(--on-yellow)!important;padding:4px 8px;border-radius:var(--radius-flap)}}
  .meta{{font:500 12px/16px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-muted)}}
  h1{{font:600 56px/56px var(--font-flap);letter-spacing:.01em;margin:var(--space-3) 0 var(--space-6);text-transform:uppercase}}
  h2{{font:600 30px/34px var(--font-flap);letter-spacing:.02em;text-transform:uppercase;margin:var(--space-12) 0 var(--space-3);color:var(--yellow-text)}}
  h3{{font-size:20px;line-height:28px;margin:var(--space-8) 0 var(--space-2)}}
  p,ul{{margin:0 0 var(--space-6)}}
  .lede{{color:var(--ink-muted);font-size:20px;line-height:32px}}
  blockquote{{margin:var(--space-8) 0;padding:var(--space-4) var(--space-6);background:var(--housing);color:var(--flap-ink);border-radius:var(--radius-sm);font:600 26px/32px var(--font-flap);letter-spacing:.02em;text-transform:uppercase}}
  blockquote p{{margin:0}}
  a{{color:var(--yellow-text)}}
  a:focus-visible{{outline:2px solid var(--focus);outline-offset:2px}}
  code{{font:15px var(--font-mono);background:var(--surface-200);padding:1px 4px;border-radius:2px}}
  .foot{{margin-top:var(--space-16);padding-top:var(--space-6);border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:var(--space-4);flex-wrap:wrap;font:500 12px/16px var(--font-mono);letter-spacing:.1em;text-transform:uppercase}}
  .foot a{{color:var(--ink-muted)}}
  @media (max-width:560px){{h1{{font-size:42px;line-height:44px}}}}
</style>
</head>
<body>
<div class="wrap">
  <nav class="top" aria-label="Journal"><a class="brand" href="../../">SOLARI</a><span><a href="../../#/post/{slug}/1">Read on the board</a> &nbsp;·&nbsp; <a href="../../">All posts</a></span></nav>
  <article>
    <div class="meta"><time datetime="{date}">{nice}</time> · {minutes} min read{tags}</div>
    <h1>{title}</h1>
    <p class="lede">{summary}</p>
{body}
  </article>
  <div class="foot">{prev}{next}</div>
</div>
</body>
</html>
"""


def build(out_root):
    out = out_root / "blog"
    if out.exists():
        shutil.rmtree(out)
    (out / "posts").mkdir(parents=True)
    shutil.copy(SRC / "index.html", out / "index.html")

    posts = [parse(p) for p in sorted((SRC / "posts").glob("*.md"))]
    posts.sort(key=lambda p: (p["date"], p["slug"]), reverse=True)
    (out / "posts.json").write_text(json.dumps({"posts": posts}, indent=1))

    live = [p for p in posts if p["status"] != "arriving"]
    for i, p in enumerate(live):
        newer = live[i - 1] if i > 0 else None
        older = live[i + 1] if i + 1 < len(live) else None
        prev = f'<a href="../{older["slug"]}/">&larr; {html.escape(older["title"])}</a>' if older else "<span></span>"
        nxt = f'<a href="../{newer["slug"]}/">{html.escape(newer["title"])} &rarr;</a>' if newer else "<span></span>"
        page = TEXT_PAGE.format(
            title=html.escape(p["title"]), summary=html.escape(p["summary"]), slug=p["slug"], date=p["date"],
            nice=nice_date(p["date"]), minutes=p["minutes"],
            tags="".join(" · " + html.escape(t) for t in p["tags"]),
            body=to_html(p["body"]), prev=prev, next=nxt)
        d = out / "posts" / p["slug"]
        d.mkdir(parents=True)
        (d / "index.html").write_text(page)

    items = []
    for p in live:
        dt = datetime.strptime(p["date"], "%Y-%m-%d").replace(hour=12, tzinfo=timezone.utc)
        link = SITE + "posts/" + p["slug"] + "/"
        items.append(f"""  <item>
    <title>{html.escape(p['title'])}</title>
    <link>{link}</link>
    <guid isPermaLink="true">{link}</guid>
    <pubDate>{format_datetime(dt)}</pubDate>
    <description>{html.escape(p['summary'])}</description>
    <content:encoded><![CDATA[{to_html(p['body'])}]]></content:encoded>
  </item>""")
    feed = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>SOLARI Journal</title>
  <link>{SITE}</link>
  <atom:link href="{SITE}feed.xml" rel="self" type="application/rss+xml"/>
  <description>A blog that is a split-flap departures board.</description>
  <language>en</language>
{chr(10).join(items)}
</channel>
</rss>
"""
    (out / "feed.xml").write_text(feed)
    return len(live), len(posts) - len(live)


if __name__ == "__main__":
    print(build(ROOT / "docs"))
