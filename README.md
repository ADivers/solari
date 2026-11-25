# SOLARI

A split-flap departures-board website theme and design system.

SOLARI is a website system modelled on the split-flap departures board — the clattering black board above a station concourse, where every character is a printed card on a drum and a change ripples across the board one flap at a time. Sites built on it read the same way: big, plain, updated in place, and only ever saying where, when and which platform.

## Principles

- **The board says it; the page explains it.** A page leads with one SplitFlap message or one DepartureBoard. Everything around it is quiet, real text.
- **Forward only.** A flap never jumps. It steps through its drum (`DRUM`, space → A–Z → 0–9 → punctuation) until it lands, so a change takes as long as it would on the real thing. That rhythm is the brand; don't shortcut it except under reduced motion.
- **Black, white, yellow.** The housing is black, information is white, and yellow is the one thing you need to notice — the headline, a delay, the primary button. If two things on screen are yellow, one of them is wrong.
- **Mechanical, not digital.** Nothing fades, glows, blurs or slides. Corners are sheet-metal square; only flaps get the slightly moulded `radius-flap`.

## Content fundamentals

- **Boards speak in short capitals.** Destination names, times, platforms, two-word remarks: `NOW DEPARTING`, `DELAY 5`, `PLATFORM 9`. Fit the column; truncate on purpose (`MILANO`, not `MILANO CENTRA`).
- **Times are 24-hour with a colon**: `09:42`. Platforms are right-aligned numbers.
- **Use only drum characters** on a flap: `A–Z 0–9 . , : - / ' & ! ? + # % ( )` and space. Anything else lands blank.
- **Body copy is sentence case**, short, second person, present tense: "Book any route on the board in under a minute." No exclamation marks off the board.
- **Labels are mono capitals** in the `label` style: `PLATFORMS 1–12`, `STATION TIME`, `REMARKS`. A bilingual caption (`DEPARTURES · PARTENZE`) is welcome — it is a station, after all.
- **No emoji, no icons.** The flap is the only pictogram; the arrow `→` on a button is the one glyph.

## Colour

- Ground every page in `surface-000`; panels on `surface-100`; hover fills `surface-200`.
- Headings and body in `ink`; secondary copy and labels in `ink-muted`.
- `solari-yellow` fills the primary button and the yellow flap characters (`flap-yellow`). Text on yellow is always `on-yellow`. For yellow **words** on page surfaces (active nav, eyebrows, links) use `yellow-text`, which darkens to `#7a5c00` on the Daylight theme.
- Boards use `housing`, `flap`, `flap-split`, `flap-ink`, `flap-yellow` and `board-muted`. They are the same in both themes: a board is a physical object and stays black on the light Daylight theme too.
- Light a flap white for information and yellow for the message that must stand out — a headline, a delay, the row that is boarding now. `flap-alert` (red) is for a `CANCELLED` StatusFlap only, always with its word.
- Hairlines are `line`; anything a person operates gets `line-strong` (≥3:1).
- **Themes.** Station (dark) is primary. Daylight (light) swaps the surfaces and ink: set `data-theme="daylight"` on `<html>`.

## Type

- **Barlow Condensed 600** (`--font-flap`, Google Fonts; falls back to Arial Narrow) is the flap face — a narrow grotesque in the spirit of the Helvetica-cut cards on real boards. It appears only on flaps and StatusFlaps.
- `--font-sans` (system stack) for everything people read: `h1` 44/48, `h2` 28/32, `h3` 20/28, `lede` 18/28 in `ink-muted`, `body` 16/24.
- `--font-mono` for labels, column headers and data captions (`label` 12/16, +0.1em, uppercase).

## The board (SplitFlap, DepartureBoard, Clock)

- A full-width hero uses `fit` (cells scale to the column, capped by `maxHeight`); everything else uses a size step: `flap-sm` 24px (nav, phones), `flap-md` 36px (rows, clocks, stats), `flap-lg` 56px (a fixed hero).
- Give every SplitFlap a `length` that fits its longest message so the board never resizes.
- Cycling boards hold each message for `interval` ms (default 3500) **after** its flaps land, so it is always readable however far the drum has to travel. Flips run 70ms each with a 35ms stagger per cell, left to right.
- DepartureBoard columns are measured in cells. Typical: Time 5, Destination 10–12, Via 8, Plat 2 (right-aligned), Remarks 8. On phones drop Via and step the size down to 16px so the board fits without scrolling.
- Update a row by changing its data; only the cells whose characters change will move.

## Layout and spacing

- Content column max 1104px, side gutter `space-6`.
- Sections are separated by a `line` hairline and padded `space-12`; the hero gets `space-16` on top.
- Panel grids use a `space-4` gutter and `minmax(260px, 1fr)` columns.
- No shadows. Depth comes from the housing being darker than the page.

## Motion

- The only motion is the flap: the top half folds down (rotateX 0 → −90°) and the next card's bottom half drops into place, 70ms per character.
- Buttons change colour in 120ms linear; the primary button swaps yellow for `ink` on hover.
- Under `prefers-reduced-motion`, flaps land instantly on their final character.

## States and focus

- Every interactive element shows a 2px solid `focus` ring offset 2px — yellow on Station, ink on Daylight.
- Disabled controls drop to 45% opacity and keep their colours.
- Status is never colour alone: a StatusFlap always carries its word.
- Boards render their message once as screen-reader text and hide the flap cells; pass `live` to announce changes.

## Iconography

- There is no icon set and no logo. The wordmark is the name `SOLARI` on a small SplitFlap (NavBar does this). Where a pictogram is unavoidable, use a single StatusFlap or the button arrow.

---

## Use it on a page

```html
<link rel="stylesheet" href="tokens.css">              <!-- generated: docs/tokens.css -->
<link rel="stylesheet" href="components/bundle.css">
<script src="vendor/react.production.min.js"></script>
<script src="vendor/react-dom.production.min.js"></script>
<script src="components/bundle.js"></script>          <!-- window.Solari -->
<body class="sl-root">
  <div id="board"></div>
  <script>
    ReactDOM.createRoot(document.getElementById('board'))
      .render(React.createElement(Solari.SplitFlap, { messages: ['NOW DEPARTING', 'ON TIME'], length: 13, size: 'lg' }));
  </script>
</body>
```

## Repository layout

| Path | What it is |
|---|---|
| `tokens.json` | Colour (Station and Daylight themes), type, spacing, radius and flap-size tokens |
| `components/bundle.js`, `components/bundle.css` | The components (`window.Solari`: SplitFlap, DepartureBoard, Clock, Button, NavBar, Panel, StatusFlap) |
| `components/index.d.ts` | TypeScript declarations |
| `components/<Name>/` | Each component's guidelines and preview; `Homepage/` is the website theme |
| `tools/build_pages.py` | Builds the GitHub Pages site into `docs/` — rerun after changing anything above |
| `docs/` | The published site: the theme at the root, the component gallery at `/system/` |
| `vendor/` | React 18.3.1 UMD builds used by the site (MIT) |

- Live theme: https://adivers.github.io/solari/
- Component gallery: https://adivers.github.io/solari/system/
