The split-flap display: a row of flap cells that step through their drum, one character at a time, until they spell the message.

Give it `text` or a list of `messages` to cycle (one every `interval` ms), and a `length` that fits the longest one. Use `fit` for a full-width hero (cells scale to the parent, up to `maxHeight`), otherwise a `size` step: `sm` 24px, `md` 36px, `lg` 56px. `color="yellow"` for the one message that must stand out.

- Short capitals only; characters outside `Solari.DRUM` land blank.
- One cycling board per viewport.
- Renders its message once as screen-reader text; the cells are `aria-hidden`. Pass `live` if a change should be announced.
- Respects `prefers-reduced-motion` by landing instantly.
- Needs `--font-flap` (Barlow Condensed) loaded; bundle.css imports it from Google Fonts.
