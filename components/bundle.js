/* @ds-bundle: {"format":4,"namespace":"Solari","components":[{"name":"SplitFlap"},{"name":"DepartureBoard"},{"name":"Clock"},{"name":"Button"},{"name":"NavBar"},{"name":"Panel"},{"name":"StatusFlap"}]} */
(function () {
  "use strict";
  var React = window.React, h = React.createElement;
  var useState = React.useState, useEffect = React.useEffect, useRef = React.useRef, useLayoutEffect = React.useLayoutEffect;

  /* The drum: every flap carries these characters, in this order. A cell only ever
     flips forward, so going from B to A passes through the whole drum, like the real thing. */
  var DRUM = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,:-/'&!?+#%()";
  var SIZES = { sm: "var(--flap-sm)", md: "var(--flap-md)", lg: "var(--flap-lg)" };

  function norm(ch) {
    ch = String(ch == null ? " " : ch).toUpperCase();
    return DRUM.indexOf(ch) < 0 ? " " : ch;
  }
  function reducedMotion() {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; }
  }
  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(" ");
  }
  function pad(text, len, align) {
    var s = String(text == null ? "" : text).toUpperCase();
    if (s.length >= len) return s.slice(0, len);
    var gap = len - s.length;
    if (align === "right") return new Array(gap + 1).join(" ") + s;
    if (align === "center") {
      var l = Math.floor(gap / 2);
      return new Array(l + 1).join(" ") + s + new Array(gap - l + 1).join(" ");
    }
    return s + new Array(gap + 1).join(" ");
  }
  /* How long a board takes to go from one string to another, in ms. */
  function travel(from, to, speed, stagger) {
    if (reducedMotion()) return 0;
    var worst = 0, n = DRUM.length;
    for (var i = 0; i < to.length; i++) {
      var a = DRUM.indexOf(norm(from.charAt(i))), b = DRUM.indexOf(norm(to.charAt(i)));
      var steps = (b - a + n) % n;
      if (steps) worst = Math.max(worst, i * stagger + steps * speed);
    }
    return worst;
  }

  function sizeValue(size) {
    if (typeof size === "number") return size + "px";
    return SIZES[size || "md"] || size;
  }

  /* One flap unit. React renders it once; each step then updates the DOM directly and turns the
     flap with the Web Animations API, so a board of hundreds of cells costs no React re-renders. */
  function Cell(props) {
    var target = norm(props.ch);
    var root = useRef(null), st = useRef(null);
    if (!st.current) st.current = { cur: props.boot ? " " : target, timer: 0, moving: false };
    function parts() { var k = root.current.children; return { top: k[0].firstChild, bot: k[1].firstChild, fold: k[2], foldT: k[2].firstChild, drop: k[3], dropT: k[3].firstChild }; }
    (useLayoutEffect || useEffect)(function () {
      var p = parts(); p.top.textContent = p.bot.textContent = st.current.cur;
      return function () { clearTimeout(st.current.timer); };
    }, []);
    useEffect(function () {
      var s = st.current, p = parts();
      clearTimeout(s.timer);
      if (s.cur === target) return;
      if (reducedMotion() || !p.fold.animate) { s.cur = target; p.top.textContent = p.bot.textContent = target; return; }
      var half = props.speed / 2;
      function step() {
        if (s.cur === target) {                      // landed
          s.moving = false; p.bot.textContent = s.cur;
          p.fold.style.visibility = p.drop.style.visibility = "hidden";
          return;
        }
        var from = s.cur, next = DRUM.charAt((DRUM.indexOf(from) + 1) % DRUM.length);
        s.cur = next;
        p.top.textContent = next; p.bot.textContent = from;
        p.foldT.textContent = from; p.dropT.textContent = next;
        p.fold.style.visibility = p.drop.style.visibility = "visible";
        p.fold.animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(-90deg)" }], { duration: half, easing: "ease-in", fill: "forwards" });
        p.drop.animate([{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)" }], { duration: half, delay: half, easing: "ease-out", fill: "both" });
        s.timer = setTimeout(step, props.speed);
      }
      s.timer = setTimeout(step, s.moving ? props.speed : (props.delay || 0));
      s.moving = true;
    }, [target]);
    return h("span", { ref: root, className: cx("sl-cell", props.color === "yellow" && "sl-c-yellow"), "aria-hidden": "true" },
      h("span", { className: "sl-hf sl-top" }, h("span")),
      h("span", { className: "sl-hf sl-bot" }, h("span")),
      h("span", { className: "sl-hf sl-top sl-fold" }, h("span")),
      h("span", { className: "sl-hf sl-bot sl-drop" }, h("span")));
  }

  function SplitFlap(props) {
    var messages = props.messages && props.messages.length ? props.messages : [props.text == null ? "" : props.text];
    var longest = 0;
    for (var i = 0; i < messages.length; i++) longest = Math.max(longest, String(messages[i]).length);
    var length = props.length || longest || 1;
    var interval = props.interval || 3500; // hold time once the board has landed
    var speed = props.speed || 70;
    var stagger = props.stagger == null ? 35 : props.stagger;
    var boot = props.boot !== false;

    var s = useState(0), idx = s[0], setIdx = s[1];
    var prevShown = useRef(boot ? pad("", length, props.align) : null);
    var shownNow = pad(messages[idx % messages.length], length, props.align);
    useEffect(function () {
      // Hold each message for `interval` ms AFTER its flaps have landed.
      var from = prevShown.current == null ? shownNow : prevShown.current;
      prevShown.current = shownNow;
      if (messages.length < 2) return;
      var t = setTimeout(function () { setIdx(function (x) { return (x + 1) % messages.length; }); }, travel(from, shownNow, speed, stagger) + interval);
      return function () { clearTimeout(t); };
    }, [idx, messages.length, interval]);

    var ref = useRef(null);
    var s2 = useState(null), fitH = s2[0], setFitH = s2[1];
    (useLayoutEffect || useEffect)(function () {
      if (!props.fit || !ref.current) return;
      var el = ref.current, max = props.maxHeight || 120;
      function measure() {
        var w = el.parentNode ? el.parentNode.clientWidth : el.clientWidth;
        // width = cells × 0.66h + gaps (length-1) × 0.07h + padding 2 × 0.16h
        var hgt = w / (length * 0.66 + (length - 1) * 0.07 + (props.bare ? 0 : 0.32));
        setFitH(Math.max(12, Math.min(max, Math.floor(hgt))));
      }
      measure();
      if (!window.ResizeObserver) return;
      var ro = new ResizeObserver(measure);
      ro.observe(el.parentNode || el);
      return function () { ro.disconnect(); };
    }, [props.fit, length, props.maxHeight, props.bare]);

    var msg = messages[idx % messages.length];
    var shown = pad(msg, length, props.align);
    var style = Object.assign({}, props.style || {});
    style["--sl-h"] = props.fit && fitH ? fitH + "px" : sizeValue(props.size);
    style["--sl-speed"] = speed + "ms";

    var cells = [];
    for (var c = 0; c < length; c++) {
      cells.push(h(Cell, { key: c, ch: shown.charAt(c), speed: speed, delay: c * stagger, boot: boot, color: props.cellColors ? props.cellColors[c] : null }));
    }
    return h("div", {
      ref: ref,
      className: cx("sl-board", props.color === "yellow" && "sl-yellow", props.fit && "sl-fit", props.bare && "sl-bare", props.className),
      style: style
    }, h("span", { className: "sl-sr", "aria-live": props.live ? "polite" : null }, props.label || String(msg)), cells);
  }

  function DepartureBoard(props) {
    var cols = props.columns || [];
    var rows = props.rows || [];
    var count = Math.max(props.rowCount || 0, rows.length);
    var size = sizeValue(props.size || "md");
    var body = [];
    for (var r = 0; r < count; r++) {
      var row = rows[r] || {};
      body.push(h("tr", { key: r }, cols.map(function (col) {
        var v = row[col.key], text = v, color = col.color;
        if (v && typeof v === "object") { text = v.text; color = v.color || color; }
        return h("td", { key: col.key }, h(SplitFlap, {
          text: text == null ? "" : String(text), length: col.width, align: col.align, color: color,
          size: props.size || "md", speed: props.speed, stagger: props.stagger, bare: true
        }));
      })));
    }
    return h("div", { className: cx("sl-dep", props.className), style: { "--sl-h": size } },
      (props.title || props.aside) && h("div", { className: "sl-dep-title" }, h("span", null, props.title), props.aside || null),
      h("table", { "aria-label": props.label || props.title || "Departures" },
        h("thead", null, h("tr", null, cols.map(function (col) { return h("th", { key: col.key, scope: "col" }, col.label); }))),
        h("tbody", null, body)));
  }

  function two(n) { return (n < 10 ? "0" : "") + n; }
  function Clock(props) {
    var s = useState(function () { return new Date(); }), now = s[0], setNow = s[1];
    useEffect(function () {
      var t = setInterval(function () { setNow(new Date()); }, 1000);
      return function () { clearInterval(t); };
    }, []);
    var text = two(now.getHours()) + ":" + two(now.getMinutes()) + (props.seconds ? ":" + two(now.getSeconds()) : "");
    return h("div", { className: "sl-clock" },
      props.caption ? h("span", { className: "sl-label" }, props.caption) : null,
      h(SplitFlap, { text: text, size: props.size || "md", color: props.color, speed: props.speed || 45, stagger: 20, boot: props.boot, label: "Time " + text }));
  }

  function Button(props) {
    var variant = props.variant || "primary", size = props.size || "md";
    var rest = {};
    for (var k in props) if (["variant", "size", "arrow", "href", "children", "className"].indexOf(k) < 0) rest[k] = props[k];
    rest.className = cx("sl-btn", "sl-btn--" + variant, size === "sm" && "sl-btn--sm", props.className);
    var kids = [props.children];
    if (props.arrow) kids.push(h("span", { key: "a", className: "sl-btn-arrow", "aria-hidden": "true" }, "→"));
    if (props.href) { rest.href = props.href; return h.apply(null, ["a", rest].concat(kids)); }
    if (!rest.type) rest.type = "button";
    return h.apply(null, ["button", rest].concat(kids));
  }

  function NavBar(props) {
    var links = props.links || [];
    return h("header", { className: cx("sl-nav", props.className) },
      h("a", { className: "sl-nav-brand", href: props.brandHref || "#" },
        h(SplitFlap, { text: props.brand, size: props.brandSize || "sm", color: props.brandColor, boot: props.boot })),
      links.length ? h("nav", { "aria-label": "Primary" }, h("ul", { className: "sl-nav-links" }, links.map(function (l, i) {
        return h("li", { key: i }, h("a", { className: cx("sl-nav-link", l.active && "is-active"), href: l.href || "#", "aria-current": l.active ? "page" : null }, l.label));
      }))) : null,
      props.action || null);
  }

  function Panel(props) {
    return h("section", { className: cx("sl-panel", props.tone === "board" && "sl-panel--board", props.className) },
      props.label ? h("span", { className: "sl-label" }, props.label) : null,
      props.title ? h("h3", { className: "sl-panel-title" }, props.title) : null,
      props.children ? h("div", { className: "sl-panel-body" }, props.children) : null);
  }

  function StatusFlap(props) {
    var state = props.state || "ok";
    return h("span", { className: cx("sl-status", state !== "ok" && "sl-status--" + state, props.className) }, h("span", { className: "sl-status-text" }, props.children));
  }

  window.Solari = { SplitFlap: SplitFlap, DepartureBoard: DepartureBoard, Clock: Clock, Button: Button, NavBar: NavBar, Panel: Panel, StatusFlap: StatusFlap, DRUM: DRUM };
})();
