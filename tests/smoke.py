#!/usr/bin/env python3
"""Browser smoke tests for the built site. Serves the folder, drives Chromium, fails loudly.

Usage: python3 tests/smoke.py _site
Set CHROME_PATH to use an installed Chrome instead of Playwright's Chromium.
"""
import asyncio, functools, http.server, os, sys, threading
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else "_site").resolve()
VIEWPORTS = {"desktop": (1280, 800), "phone": (390, 844)}
failures = []


def check(cond, msg):
    print(("  ok   " if cond else "  FAIL ") + msg)
    if not cond:
        failures.append(msg)


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return f"http://127.0.0.1:{srv.server_address[1]}/"


async def click_flap(pg, board, pred):
    """Click the centre of the first board link matching a JS predicate on the link."""
    pos = await pg.evaluate(f"""(() => {{
      const bd = {board}; const L = bd.links().find({pred}); if (!L) return null;
      const r = bd.rect(L.row, Math.floor((L.c0 + L.c1) / 2)); const c = document.querySelector('canvas').getBoundingClientRect();
      return [c.left + r[0] + r[2] / 2, c.top + r[1] + r[3] / 2]; }})()""")
    if not pos:
        return False
    await pg.mouse.click(pos[0], pos[1])
    return True


async def until(pg, js, timeout=10000):
    try:
        await pg.wait_for_function(js, timeout=timeout)
        return True
    except Exception:
        return False


async def main():
    base = serve()
    async with async_playwright() as p:
        exe = os.environ.get("CHROME_PATH")
        browser = await p.chromium.launch(**({"executable_path": exe} if exe else {}))

        print("no JavaScript: every journal page is complete HTML")
        ctx = await browser.new_context(java_script_enabled=False)
        pg = await ctx.new_page()
        await pg.goto(base + "blog/")
        check(await pg.locator('[data-list="departures"] li').count() >= 1, "journal index lists posts without JS")
        await pg.goto(base + "blog/posts/forward-only/")
        check((await pg.inner_text("h1")).strip().upper() == "FORWARD ONLY", "post page has its title in HTML")
        check(await pg.locator("article .body p").count() >= 3, "post body is in the HTML")
        check((await pg.get_attribute('link[rel="canonical"]', "href") or "").endswith("/blog/posts/forward-only/"), "post has a canonical URL")
        check(await pg.locator('meta[property="og:title"]').count() == 1, "post has Open Graph tags")
        check(await pg.locator('script[type="application/ld+json"]').count() == 1, "post has structured data")
        await ctx.close()

        for name, (w, h) in VIEWPORTS.items():
            print(f"{name} {w}x{h}")
            ctx = await browser.new_context(viewport={"width": w, "height": h})
            pg = await ctx.new_page()
            errors = []
            pg.on("pageerror", lambda e: errors.append(str(e)))
            pg.on("console", lambda m: m.type == "error" and errors.append(m.text))

            # Theme, gallery and components render without errors.
            for path in ("", "system/", "components/SplitFlap/", "components/DepartureBoard/", "components/Homepage/"):
                await pg.goto(base + path)
                await pg.wait_for_timeout(800)
                check(await pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), f"/{path} has no sideways scroll")

            # Board experiment lands every flap on its target.
            await pg.goto(base + "board/")
            check(await until(pg, "window.__board && __board.landed()"), "board experiment lands")
            await pg.evaluate("location.hash = '#departures'")
            check(await until(pg, "__board.landed()"), "board flips to departures and lands")

            # Journal: index -> post -> page 2 -> text mode -> board again.
            await pg.goto(base + "blog/")
            check(await until(pg, "window.__journal && __journal.board() && __journal.board().landed()"), "journal index lands on the board")
            check(await click_flap(pg, "__journal.board()", "l => /posts\\/one-canvas\\//.test(l.go)"), "post row is a link on the board")
            await pg.wait_for_url("**/blog/posts/one-canvas/", timeout=5000)
            check(await until(pg, "__journal.board().landed()"), "post lands on the board")
            pages = await pg.evaluate("__journal.state().pages")
            check(pages >= 2, f"post is paginated ({pages} pages)")
            await pg.keyboard.press("ArrowRight")
            check(await until(pg, "__journal.state().page === 2 && location.hash === '#p2'"), "arrow key turns to page 2")
            check(await click_flap(pg, "__journal.board()", "l => l.go === '#text'"), "TEXT flap present")
            check(await until(pg, "!document.documentElement.classList.contains('board')"), "TEXT switches to the text page")
            check(await pg.is_visible("article h1"), "text page shows the article")
            await pg.goto(base + "blog/about/")
            check(not await pg.evaluate("document.documentElement.classList.contains('board')"), "text mode is remembered")
            await pg.click("[data-mode-toggle]")
            check(await until(pg, "document.documentElement.classList.contains('board') && __journal.board().landed()"), "toggle returns to the board")
            await pg.goto(base + "blog/")
            check(await until(pg, "__journal.board().landed()"), "index lands again")
            rows = await pg.evaluate("""(() => { const b = __journal.board(), s = b.size(), c = b.cells(); const out = [];
              for (let r = 0; r < s[1]; r++) out.push(c.slice(r * s[0], (r + 1) * s[0]).map(x => x.tgt).join('')); return out.join('\\n'); })()""")
            check("READ" in rows, "a post you opened shows READ")
            await pg.goto(base + "blog/#/post/forward-only/2")
            await pg.wait_for_url("**/blog/posts/forward-only/#p2", timeout=5000)
            check(True, "old #/post links redirect")
            check(not errors, "no console errors" + (": " + "; ".join(errors[:3]) if errors else ""))
            await ctx.close()
        await browser.close()

    print()
    if failures:
        print(f"{len(failures)} check(s) failed")
        sys.exit(1)
    print("all checks passed")


asyncio.run(main())
