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
  function sizeValue(size) {
    if (typeof size === "number") return size + "px";
    return SIZES[size || "md"] || size;
  }

  /* One flap unit. Steps through the drum toward `ch`, one flip per `speed` ms. */
  function Cell(props) {
    var target = norm(props.ch);
    var s1 = useState(props.boot ? " " : target), cur = s1[0], setCur = s1[1];
    var s2 = useState(null), flip = s2[0], setFlip = s2[1];
    var moving = useRef(false), n = useRef(0);

    useEffect(function () {
      if (cur === target) { moving.current = false; return; }
      if (reducedMotion()) { setFlip(null); setCur(target); return; }
      var t = setTimeout(function () {
        moving.current = true;
        var next = DRUM.charAt((DRUM.indexOf(cur) + 1) % DRUM.length);
        n.current += 1;
        setFlip({ from: cur, to: next, n: n.current });
        setCur(next);
      }, moving.current ? props.speed : (props.delay || 0));
      return function () { clearTimeout(t); };
    }, [cur, target]);

    var kids = [
      h("span", { key: "t", className: "sl-hf sl-top" }, h("span", null, cur)),
      h("span", { key: "b", className: "sl-hf sl-bot" }, h("span", null, flip ? flip.from : cur))
    ];
    if (flip) {
      kids.push(h("span", { key: "f" + flip.n, className: "sl-hf sl-top sl-fold" }, h("span", null, flip.from)));
      kids.push(h("span", { key: "d" + flip.n, className: "sl-hf sl-bot sl-drop" }, h("span", null, flip.to)));
    }
    return h("span", { className: cx("sl-cell", props.color === "yellow" && "sl-c-yellow"), "aria-hidden": "true" }, kids);
  }

  function SplitFlap(props) {
    var messages = props.messages && props.messages.length ? props.messages : [props.text == null ? "" : props.text];
    var longest = 0;
    for (var i = 0; i < messages.length; i++) longest = Math.max(longest, String(messages[i]).length);
    var length = props.length || longest || 1;
    var interval = props.interval || 4000;
    var speed = props.speed || 70;
    var stagger = props.stagger == null ? 35 : props.stagger;
    var boot = props.boot !== false;

    var s = useState(0), idx = s[0], setIdx = s[1];
    useEffect(function () {
      if (messages.length < 2) return;
      var t = setInterval(function () { setIdx(function (x) { return (x + 1) % messages.length; }); }, interval);
      return function () { clearInterval(t); };
    }, [messages.length, interval]);

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
      h("a", { className: "sl-nav-brand", href: props.brandHref || "#", "aria-label": props.brand + " home" },
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
