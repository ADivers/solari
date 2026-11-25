/* SOLARI board engine — one canvas, a full grid of split flaps.
 *
 *   var board = SolariBoard(canvas, {
 *     compose: function (cols, fitRows) { return { grid: [[["A","w"], ...], ...], links: [{row, c0, c1, go}] }; },
 *     onLink:  function (link) { ... },
 *     density: function (viewportWidth) { return 54; }   // optional: target columns
 *   });
 *   board.refresh(true);   // recompose; changed flaps flip (false = land instantly)
 *
 * Colours per cell: w white · y yellow · m muted · Y black on a yellow flap · r white on a red flap.
 * Colours come from tokens.css custom properties when present.
 */
(function () {
  "use strict";
  var DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:;-/'\"&!?+#%()<>";

  function norm(ch) {
    ch = (ch || " ").toUpperCase();
    return DRUM.indexOf(ch) < 0 ? " " : ch;
  }
  /* Make arbitrary prose drum-safe: smart quotes, dashes, ellipses, accents. */
  function clean(text) {
    return String(text == null ? "" : text)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"')
      .replace(/[–—−]/g, "-").replace(/…/g, "...").replace(/·/g, "-")
      .replace(/×/g, "X").replace(/[\t\n\r]/g, " ")
      .toUpperCase();
  }
  function pad(s, n) { s = String(s); return s.length >= n ? s.slice(0, n) : s + Array(n - s.length + 1).join(" "); }
  function padL(s, n) { s = String(s); return s.length >= n ? s.slice(-n) : Array(n - s.length + 1).join(" ") + s; }
  function wrap(text, width, indent) {
    indent = indent || "";
    var words = String(text).split(" "), lines = [], cur = "", w0 = width;
    words.forEach(function (w) {
      if (!w) return;
      var room = lines.length ? width - indent.length : w0;
      while (w.length > room) { if (cur) { lines.push(cur); cur = ""; room = width - indent.length; } lines.push(w.slice(0, room)); w = w.slice(room); }
      if (!cur) cur = w;
      else if ((cur + " " + w).length <= (lines.length ? width - indent.length : w0)) cur += " " + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur || !lines.length) lines.push(cur);
    return lines.map(function (l, i) { return i ? indent + l : l; });
  }

  function SolariBoard(canvas, opts) {
    var SPEED = opts.speed || 60, STAGGER_COL = opts.staggerCol == null ? 9 : opts.staggerCol, STAGGER_ROW = opts.staggerRow == null ? 22 : opts.staggerRow;
    var REDUCED = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    var css = getComputedStyle(document.documentElement);
    function tok(n, d) { return (css.getPropertyValue("--" + n) || "").trim() || d; }
    var C = {
      housing: tok("housing", "#0a0a09"), flap: tok("flap", "#1f1f1d"), split: tok("flap-split", "#050505"),
      w: tok("flap-ink", "#f2efe6"), y: tok("solari-yellow", "#f5c400"), m: tok("board-muted", "#9c998f"),
      alert: tok("flap-alert", "#b3261e"), onY: tok("on-yellow", "#141413")
    };
    var ctx = canvas.getContext("2d");
    var dpr = 1, cols = 0, rows = 0, cw = 0, ch = 0, gap = 0, padX = 0, padY = 0, fitRows = 0;
    var cells = [], links = [], hover = null, raf = 0;

    function density(W) {
      if (opts.density) return opts.density(W);
      return W < 520 ? 22 : W < 820 ? 32 : W < 1200 ? 44 : 54;
    }
    function measure() {
      var W = window.innerWidth, H = window.innerHeight, want = density(W);
      gap = Math.max(2, Math.round(W / 420));
      padX = Math.max(10, Math.round(W * 0.02));
      cw = Math.floor((W - padX * 2 - gap * (want - 1)) / want);
      ch = Math.round(cw / 0.68);
      cols = Math.floor((W - padX * 2 + gap) / (cw + gap));
      padX = Math.floor((W - (cols * cw + (cols - 1) * gap)) / 2);
      padY = padX;
      fitRows = Math.max(8, Math.floor((H - padY * 2 + gap) / (ch + gap)));
    }

    function refresh(animate) {
      measure();
      var comp = opts.compose(cols, fitRows);
      var grid = comp.grid;
      rows = Math.max(fitRows, grid.length);
      for (var r = 0; r < rows; r++) {
        var row = grid[r] || [];
        for (var c = 0; c < cols; c++) if (!row[c]) row[c] = [" ", "w"];
        grid[r] = row;
      }
      links = comp.links || [];
      var W = window.innerWidth, H = rows * ch + (rows - 1) * gap + padY * 2;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      var resized = canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr) || cells.length !== rows * cols;
      if (resized) {
        var first = !cells.length;
        canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
        cells = [];
        for (var i = 0; i < rows * cols; i++) cells.push({ cur: " ", curC: "w", tgt: " ", tgtC: "w", from: " ", fromC: "w", start: 0, delay: 0 });
        if (!first) animate = false;     // a resize or a longer page lands instantly
      }
      var t0 = performance.now();
      for (var r2 = 0; r2 < rows; r2++) for (var c2 = 0; c2 < cols; c2++) {
        var cell = cells[r2 * cols + c2], g = grid[r2][c2];
        cell.tgt = norm(g[0]); cell.tgtC = g[1] || "w";
        if (!animate || REDUCED) { cell.cur = cell.tgt; cell.curC = cell.tgtC; cell.start = 0; continue; }
        if ((cell.cur !== cell.tgt || cell.curC !== cell.tgtC) && !cell.start) cell.delay = t0 + c2 * STAGGER_COL + r2 * STAGGER_ROW;
      }
      if (hover && !links.some(function (l) { return l.go === hover.go && l.row === hover.row; })) hover = null;
      drawAll();
      kick();
    }

    /* drawing */
    function font() { return "600 " + Math.round(ch * 0.9) + 'px "Barlow Condensed", "Arial Narrow", sans-serif'; }
    function face(c) { return c === "r" ? C.alert : c === "Y" ? C.y : C.flap; }
    function ink(c) { return c === "y" ? C.y : c === "m" ? C.m : c === "Y" ? C.onY : C.w; }
    function xy(i) { var r = Math.floor(i / cols), c = i % cols; return [padX + c * (cw + gap), padY + r * (ch + gap)]; }
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
    function half(x, y, chr, col, top, k, shade) {
      var mid = y + ch / 2;
      ctx.save();
      ctx.beginPath();
      if (top) ctx.rect(x, y, cw, ch / 2); else ctx.rect(x, mid, cw, ch / 2);
      ctx.clip();
      if (k !== 1) { ctx.translate(0, mid); ctx.scale(1, k); ctx.translate(0, -mid); }
      ctx.fillStyle = face(col); rr(x, y, cw, ch, Math.min(3, cw / 6)); ctx.fill();
      if (chr !== " ") { ctx.fillStyle = ink(col); ctx.fillText(chr, x + cw / 2, mid + ch * 0.02); }
      if (shade) { ctx.fillStyle = "rgba(0,0,0," + shade + ")"; ctx.fillRect(x, y, cw, ch); }
      ctx.restore();
    }
    function isHot(i) { return hover && Math.floor(i / cols) === hover.row && i % cols >= hover.c0 && i % cols <= hover.c1; }
    function hotC(c, hot) { return hot ? (c === "y" ? "w" : c === "m" ? "w" : c === "w" ? "y" : c) : c; }
    function drawCell(i, now) {
      var p = xy(i), x = p[0], y = p[1], cell = cells[i], hot = isHot(i);
      ctx.fillStyle = C.housing; ctx.fillRect(x - gap / 2, y - gap / 2, cw + gap, ch + gap);
      var t = cell.start ? Math.min(1, (now - cell.start) / SPEED) : 1;
      var curC = hotC(cell.curC, hot), fromC = hotC(cell.fromC, hot);
      if (t >= 1 || !cell.start) { half(x, y, cell.cur, curC, true, 1, 0); half(x, y, cell.cur, curC, false, 1, 0); }
      else {
        half(x, y, cell.cur, curC, true, 1, 0);
        half(x, y, cell.from, fromC, false, 1, 0);
        if (t < 0.5) half(x, y, cell.from, fromC, true, Math.cos(t * Math.PI), 0.45 * t * 2);
        else half(x, y, cell.cur, curC, false, -Math.cos(t * Math.PI), 0.35 * (1 - (t - 0.5) * 2));
      }
      ctx.fillStyle = C.split;
      var sh = Math.max(1, Math.round(ch * 0.03)), pin = Math.max(1, cw * 0.05);
      ctx.fillRect(x, y + ch / 2 - sh / 2, cw, sh);
      ctx.fillRect(x - 1, y + ch / 2 - ch * 0.06, pin, ch * 0.12);
      ctx.fillRect(x + cw - pin + 1, y + ch / 2 - ch * 0.06, pin, ch * 0.12);
    }
    function prep() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.font = font(); ctx.textAlign = "center"; ctx.textBaseline = "middle"; }
    function drawAll() {
      prep();
      ctx.fillStyle = C.housing; ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      var now = performance.now();
      for (var i = 0; i < cells.length; i++) drawCell(i, now);
    }

    /* engine: each moving cell steps one card per SPEED ms, forward through the drum */
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    function frame(now) {
      raf = 0; prep();
      var busy = false;
      for (var i = 0; i < cells.length; i++) {
        var c = cells[i];
        if (c.start) {
          if (now - c.start < SPEED) { drawCell(i, now); busy = true; continue; }
          c.start = 0; drawCell(i, now);
        }
        if (c.cur !== c.tgt || c.curC !== c.tgtC) {
          busy = true;
          if (now < c.delay) continue;
          c.from = c.cur; c.fromC = c.curC;
          if (c.cur !== c.tgt) c.cur = DRUM.charAt((DRUM.indexOf(c.cur) + 1) % DRUM.length);
          if (c.cur === c.tgt) c.curC = c.tgtC;
          c.start = now; c.delay = 0;
          drawCell(i, now);
        }
      }
      if (busy) kick();
    }

    /* pointer */
    function linkAt(ev) {
      var rect = canvas.getBoundingClientRect(), x = ev.clientX - rect.left, y = ev.clientY - rect.top;
      var c = Math.floor((x - padX + gap / 2) / (cw + gap)), r = Math.floor((y - padY + gap / 2) / (ch + gap));
      for (var i = 0; i < links.length; i++) { var l = links[i]; if (l.row === r && c >= l.c0 && c <= l.c1) return l; }
      return null;
    }
    function redrawLink(l) { if (!l) return; prep(); var now = performance.now(); for (var c = l.c0; c <= l.c1; c++) drawCell(l.row * cols + c, now); }
    canvas.addEventListener("mousemove", function (ev) {
      var l = linkAt(ev);
      if (l !== hover) { var old = hover; hover = l; redrawLink(old); redrawLink(l); canvas.style.cursor = l ? "pointer" : "default"; }
    });
    canvas.addEventListener("mouseleave", function () { var old = hover; hover = null; redrawLink(old); });
    canvas.addEventListener("click", function (ev) { var l = linkAt(ev); if (l && opts.onLink) opts.onLink(l, ev); });
    var rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { refresh(false); }, 120); });

    return {
      refresh: refresh,
      blank: function () { cells.forEach(function (c) { c.cur = " "; c.curC = "w"; c.start = 0; }); drawAll(); },
      size: function () { return [cols, rows, fitRows]; },
      cells: function () { return cells; },
      links: function () { return links; },
      landed: function () { return cells.every(function (c) { return c.cur === c.tgt && c.curC === c.tgtC; }); }
    };
  }

  /* A small grid writer for compose(): rows of [char, colour] plus link rectangles. */
  function Grid(cols) {
    var g = { rows: [], links: [], cols: cols };
    g.blank = function () { var r = []; for (var i = 0; i < cols; i++) r.push([" ", "w"]); g.rows.push(r); return g.rows.length - 1; };
    g.ensure = function (r) { while (g.rows.length <= r) g.blank(); };
    g.put = function (r, c0, text, color, go) {
      g.ensure(r);
      text = clean(text);
      for (var i = 0; i < text.length && c0 + i < cols; i++) if (c0 + i >= 0) g.rows[r][c0 + i] = [norm(text[i]), color || "w"];
      if (go) g.links.push({ row: r, c0: Math.max(0, c0), c1: Math.min(cols, c0 + text.length) - 1, go: go });
      return c0 + text.length;
    };
    g.line = function (text, color, go) { var r = g.blank(); g.put(r, 0, text, color, go); return r; };
    g.para = function (text, color, indent) { wrap(clean(text).replace(/ +/g, " ").trim(), cols, indent).forEach(function (l) { g.line(l, color); }); };
    g.out = function () { return { grid: g.rows, links: g.links }; };
    return g;
  }

  window.SolariBoard = SolariBoard;
  SolariBoard.Grid = Grid;
  SolariBoard.DRUM = DRUM;
  SolariBoard.clean = clean;
  SolariBoard.wrap = wrap;
  SolariBoard.pad = pad;
  SolariBoard.padL = padL;
})();
