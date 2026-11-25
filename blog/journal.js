/* SOLARI Journal — turns a journal page into a split-flap board.
 *
 * The page is complete, crawlable HTML before this runs. In board mode (html.board,
 * set in <head>) the HTML is visually hidden but stays in the document for screen
 * readers, search engines and copy; this script reads its text and lays it out on
 * the board. Links on the board are the page's real links.
 */
(function () {
  "use strict";
  var B = window.SolariBoard;
  var docEl = document.documentElement, body = document.body;
  var ROOT = body.getAttribute("data-root") || "";
  var KIND = body.getAttribute("data-page") || "index";
  var MODE_KEY = "solari-journal-mode", READ_KEY = "solari-journal-read";

  // Old single-page links (#/post/slug/2, #/about) still land on the right page.
  function legacyRedirect() {
    if (KIND !== "index") return false;
    var m = location.hash.match(/^#\/post\/([^\/]+)\/?(\d+)?/);
    if (m) { location.replace(ROOT + "posts/" + m[1] + "/" + (m[2] > 1 ? "#p" + m[2] : "")); return true; }
    if (location.hash === "#/about") { location.replace(ROOT + "about/"); return true; }
    return false;
  }
  if (legacyRedirect()) return;
  window.addEventListener("hashchange", legacyRedirect);

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function readSet() { try { return JSON.parse(store(READ_KEY) || "[]"); } catch (e) { return []; } }
  function isRead(slug) { return readSet().indexOf(slug) >= 0; }
  function markRead(slug) { var s = readSet(); if (s.indexOf(slug) < 0) { s.push(slug); store(READ_KEY, JSON.stringify(s)); } }

  var article = document.querySelector("article[data-slug]");
  if (article) markRead(article.getAttribute("data-slug"));

  // Text <-> board toggle (the button in the page header, and the TEXT flap).
  var toggle = document.querySelector("[data-mode-toggle]");
  function setMode(mode) {
    store(MODE_KEY, mode);
    if (mode === "board") {
      if (/[?&]text\b/.test(location.search)) { location.href = location.pathname + location.hash; return; }
      docEl.classList.add("board"); window.scrollTo(0, 0);
      if (started) { board.refresh(false); board.blank(); board.refresh(true); } else start();
    }
    else { docEl.classList.remove("board"); stopAuto(); window.scrollTo(0, 0); }
  }
  if (toggle) toggle.addEventListener("click", function () { setMode("board"); });
  if (!B) { docEl.classList.remove("board"); return; }   // engine failed to load: stay a normal page

  var pad = B.pad, padL = B.padL, clean = B.clean, wrap = B.wrap;
  var MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  function dd(d) { var p = d.split("-"); return padL(String(+p[2]), 2) + " " + MONTHS[+p[1] - 1]; }
  function two(n) { return (n < 10 ? "0" : "") + n; }
  function text(el) { return el ? el.textContent.replace(/\s+/g, " ").trim() : ""; }

  /* ---------------------------------------------------------- read the page */
  function readIndex() {
    function item(li) {
      var a = li.querySelector("h3 a"), h = li.querySelector("h3");
      return { slug: li.getAttribute("data-slug"), date: li.getAttribute("data-date"), minutes: li.getAttribute("data-minutes"),
        status: li.getAttribute("data-status"), title: text(h), href: a ? a.getAttribute("href") : null, summary: text(li.querySelector("p")) };
    }
    return {
      live: [].map.call(document.querySelectorAll('[data-list="departures"] > li'), item),
      arriving: [].map.call(document.querySelectorAll('[data-list="arrivals"] > li'), item)
    };
  }
  function readArticle() {
    var blocks = [];
    [].forEach.call(article.querySelectorAll(".body > *"), function (n) {
      var t = n.tagName;
      if (t === "H2" || t === "H3") blocks.push({ kind: "h", t: text(n) });
      else if (t === "BLOCKQUOTE") blocks.push({ kind: "q", t: text(n) });
      else if (t === "UL" || t === "OL") [].forEach.call(n.children, function (li, i) { blocks.push({ kind: "li", t: text(li), first: i === 0 }); });
      else blocks.push({ kind: "p", t: text(n) });
    });
    return {
      slug: article.getAttribute("data-slug"), date: article.getAttribute("data-date"), minutes: article.getAttribute("data-minutes"),
      tags: (article.getAttribute("data-tags") || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      title: text(article.querySelector("h1")), summary: text(article.querySelector(".lede")), blocks: blocks,
      prev: document.querySelector('a[rel="prev"]'), next: document.querySelector('a[rel="next"]')
    };
  }

  /* ---------------------------------------------------------- layout */
  var NAV = [["POSTS", ROOT, "index"], ["ABOUT", ROOT + "about/", "about"], ["RSS", ROOT + "feed.xml", ""]];
  function header(g, cols) {
    g.blank();
    var x = g.put(0, 0, "SOLARI", "Y", ROOT);
    if (cols >= 30) g.put(0, x + 1, "JOURNAL", "w");
    var navW = NAV.reduce(function (a, n) { return a + n[0].length + 1; }, 0) - 1, row = 0, nx;
    if (cols - (cols >= 30 ? 14 : 6) - 1 >= navW) nx = cols - navW; else { row = g.blank(); nx = 0; }
    NAV.forEach(function (n) { g.put(row, nx, n[0], n[2] === KIND ? "y" : "m", n[1]); nx += n[0].length + 1; });
    return g.rows.length;
  }
  function clock(g, row) { var now = new Date(); g.put(row, 0, two(now.getHours()) + ":" + two(now.getMinutes()), "y"); }

  function composeIndex(g, cols, fit) {
    var data = readIndex(), L = data.live, A = data.arriving;
    header(g, cols); g.blank();
    var showMin = cols >= 30, statusW = 4, minW = showMin ? 3 : 0;
    var titleW = cols - 6 - 1 - (showMin ? minW + 1 : 0) - statusW - 1;
    var narrow = cols < 30 || L.concat(A).some(function (p) { return clean(p.title).length > titleW; });
    var dr = g.line("DEPARTURES", "y");
    if (cols >= 30) g.put(dr, cols - 9, "PARTENZE", "m");
    if (!narrow) {
      var hr = g.blank(), x = g.put(hr, 0, "DATE  ", "m"); g.put(hr, x + 1, "TITLE", "m");
      if (showMin) g.put(hr, cols - statusW - 1 - minW, "MIN", "m");
    }
    function entry(p, status, sc, tc) {
      var go = p.href;
      if (!narrow) {
        var r = g.blank(), x2 = g.put(r, 0, pad(dd(p.date), 6), "w");
        g.put(r, x2 + 1, pad(clean(p.title), titleW), tc || "w");
        if (showMin && p.minutes) g.put(r, cols - statusW - 1 - minW, padL(p.minutes, minW), "w");
        g.put(r, cols - statusW, pad(status, statusW), sc);
        if (go) g.links.push({ row: r, c0: 0, c1: cols - 1, go: go });
        return;
      }
      var r0 = g.blank(); g.put(r0, 0, dd(p.date) + (p.minutes ? "  " + p.minutes + " MIN" : ""), "w"); g.put(r0, cols - statusW, pad(status, statusW), sc);
      var r1 = r0;
      wrap(clean(p.title), cols).slice(0, 2).forEach(function (t) { r1 = g.line(t, tc || "w"); });
      if (go) for (var k = r0; k <= r1; k++) g.links.push({ row: k, c0: 0, c1: cols - 1, go: go });
    }
    L.forEach(function (p) { var read = isRead(p.slug); entry(p, read ? "READ" : "NEW", read ? "m" : "Y"); });
    if (A.length) { g.blank(); g.line("ARRIVALS", "y"); A.forEach(function (p) { entry(p, "DUE", "m", "m"); }); }
    var nb = L.filter(function (p) { return !isRead(p.slug); })[0] || L[0];
    if (nb && g.rows.length + 6 < fit) {
      g.blank(); g.line(isRead(nb.slug) ? "LATEST" : "NOW BOARDING", "m");
      wrap(clean(nb.summary).replace(/ +/g, " "), cols).slice(0, Math.max(1, fit - g.rows.length - 4)).forEach(function (l) { g.line(l, "w"); });
      var cta = "> READ " + clean(nb.title);
      g.line(cta.length <= cols ? cta : "> READ IT NOW", "y", nb.href);
    }
    var last = Math.max(fit, g.rows.length + 2) - 1;
    clock(g, last);
    var tail = L.length + " POSTS";
    if (cols > 12 + tail.length) g.put(last, cols - tail.length, tail, "m");
  }

  // Article -> lines at this width, then pages that fit the board.
  function postLines(post, cols) {
    var lines = [];
    function blank() { if (lines.length && lines[lines.length - 1].t !== "") lines.push({ t: "", c: "w" }); }
    function push(t, c, indent, kind) {
      wrap(clean(t).replace(/ +/g, " ").trim(), cols, indent).forEach(function (l, i) { lines.push({ t: l, c: c, kind: i === 0 ? kind : "cont" }); });
    }
    wrap(clean(post.title), cols).forEach(function (t) { lines.push({ t: t, c: "y", kind: "t" }); });
    lines.push({ t: clean(dd(post.date) + " " + post.date.slice(0, 4) + " - " + post.minutes + " MIN" + (post.tags[0] ? " - " + post.tags[0] : "")), c: "m" });
    blank(); push(post.summary, "m", "", "p");
    post.blocks.forEach(function (b) {
      if (b.kind === "h") { blank(); push(b.t, "y", "", "h"); }
      else if (b.kind === "q") { blank(); push('"' + b.t + '"', "m", " ", "q"); }
      else if (b.kind === "li") { if (b.first) blank(); push("- " + b.t, "w", "  ", "li"); }
      else { blank(); push(b.t, "w", "", "p"); }
    });
    return lines;
  }
  function paginate(lines, size) {
    var pages = [], cur = [];
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i];
      if (!cur.length && l.t === "") continue;
      if (cur.length >= size || (l.kind === "h" && cur.length >= size - 2)) { pages.push(cur); cur = []; if (l.t === "") continue; }
      cur.push(l);
    }
    if (cur.length) pages.push(cur);
    return pages.length ? pages : [[]];
  }

  var state = { page: 1, pages: 1, words: 0 }, auto = false, autoTimer = 0;
  function pageFromHash() { var m = location.hash.match(/^#p(\d+)$/); return m ? +m[1] : 1; }

  function composePost(g, cols, fit) {
    var post = readArticle();
    var hrows = header(g, cols);
    var pages = paginate(postLines(post, cols), Math.max(4, fit - hrows - 1 - 3));
    state.pages = pages.length;
    state.page = Math.min(Math.max(1, pageFromHash()), pages.length);
    var n = state.page;
    var mark = g.blank();
    if (n > 1) g.put(mark, 0, clean(post.title).slice(0, Math.max(0, cols - 6)).trim() + " CONT.", "m");
    state.words = 0;
    pages[n - 1].forEach(function (l) { g.line(l.t, l.c); state.words += (l.t.match(/[A-Z0-9']+/g) || []).length; });
    var last = Math.max(fit, g.rows.length + 3) - 1, f1 = last - 1;
    g.put(f1, 0, "< ALL POSTS", "m", ROOT);
    if (cols >= 24) { var at = auto ? "AUTO ON" : "AUTO"; g.put(f1, Math.max(12, Math.floor((cols - at.length) / 2)), at, auto ? "y" : "m", "#auto"); }
    g.put(f1, cols - 4, "TEXT", "m", "#text");
    if (n > 1) g.put(last, 0, "< PREV", "y", "#p" + (n - 1));
    else if (post.prev && cols >= 30) g.put(last, 0, "< OLDER", "m", post.prev.getAttribute("href"));
    var counter = n + "/" + pages.length;
    g.put(last, Math.floor((cols - counter.length) / 2), counter, "w");
    if (n < pages.length) g.put(last, cols - 6, "NEXT >", "y", "#p" + (n + 1));
    else if (post.next) g.put(last, cols - 7, "NEWER >", "y", post.next.getAttribute("href"));
    else g.put(last, cols - 4, "END.", "m");
  }

  function composeAbout(g, cols, fit) {
    header(g, cols); g.blank();
    var main = document.querySelector("main");
    g.line(clean(text(main.querySelector("h1"))), "y"); g.blank();
    [].forEach.call(main.querySelectorAll(":scope > p"), function (p) { g.para(text(p), p.classList.contains("lede") ? "w" : "w"); g.blank(); });
    [].forEach.call(main.querySelectorAll("li a"), function (a) { g.line("> " + clean(text(a)), "y", a.getAttribute("href")); });
    clock(g, Math.max(fit, g.rows.length + 2) - 1);
  }

  function compose(cols, fit) {
    var g = B.Grid(cols);
    if (KIND === "post" && article) composePost(g, cols, fit);
    else if (KIND === "about") composeAbout(g, cols, fit);
    else composeIndex(g, cols, fit);
    return g.out();
  }

  /* ---------------------------------------------------------- behaviour */
  var board = null;
  function follow(l) {
    if (l.go === "#auto") return toggleAuto();
    if (l.go === "#text") return setMode("text");
    if (/^https?:/.test(l.go)) { window.open(l.go, "_blank", "noopener"); return; }
    if (l.go.charAt(0) === "#") { location.hash = l.go; return; }
    location.href = l.go;
  }
  function turn(d) {
    if (KIND !== "post") return;
    var n = state.page + d;
    if (n < 1 || n > state.pages) { if (d > 0) stopAuto(); return; }
    location.hash = "#p" + n;
  }
  function stopAuto() { if (auto) { auto = false; clearTimeout(autoTimer); if (board) board.refresh(true); } }
  function toggleAuto() { if (KIND !== "post") return; auto = !auto; clearTimeout(autoTimer); board.refresh(true); if (auto) scheduleAuto(); }
  // AUTO: once the board has landed, hold for the page's reading time (230 wpm, 4 s minimum), then turn.
  function scheduleAuto() {
    clearTimeout(autoTimer);
    var hold = Math.max(4000, state.words / 230 * 60000);
    (function wait() {
      if (!auto) return;
      if (!board.landed()) { autoTimer = setTimeout(wait, 250); return; }
      autoTimer = setTimeout(function () { if (auto) turn(1); }, hold);
    })();
  }

  var started = false;
  function start() {
    if (started || !docEl.classList.contains("board")) return;
    started = true;
    board = B(document.getElementById("board"), { compose: compose, onLink: follow });
    window.addEventListener("hashchange", function () { if (docEl.classList.contains("board")) { board.refresh(true); if (auto) scheduleAuto(); } });
    window.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey || !docEl.classList.contains("board") || KIND !== "post") return;
      if (/^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test((document.activeElement || {}).tagName || "") && e.key === " ") return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) { e.preventDefault(); turn(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) { e.preventDefault(); turn(-1); }
      else if (e.key === "Escape") location.href = ROOT;
      else if (e.key === "a" || e.key === "A") toggleAuto();
    });
    var tx = null, ty = null;
    window.addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    window.addEventListener("touchend", function (e) {
      if (tx == null) return;
      var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; tx = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(dx < 0 ? 1 : -1);
    }, { passive: true });
    var lastMin = new Date().getMinutes();
    setInterval(function () { var m = new Date().getMinutes(); if (m !== lastMin && docEl.classList.contains("board")) { lastMin = m; board.refresh(true); } }, 1000);

    var font = document.fonts && document.fonts.load ? document.fonts.load('600 40px "Barlow Condensed"') : Promise.resolve();
    Promise.race([font, new Promise(function (r) { setTimeout(r, 1200); })]).then(function () {
      board.refresh(false); board.blank(); board.refresh(true);
    });
  }
  start();
  window.__journal = { board: function () { return board; }, state: function () { return state; } };
})();
