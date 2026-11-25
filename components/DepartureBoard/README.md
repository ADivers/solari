A departures table on the black housing: mono column headers over rows of split-flap cells, which flip in place when their values change.

Define `columns` (`key`, `label`, `width` in cells, optional `align` and `color`) and pass `rows` keyed the same way. A cell value may be a string or `{ text, color: 'yellow' }` to light one cell yellow (a delay, the row boarding now). `rowCount` keeps the board a fixed height; missing rows show as blank flaps. `title` and `aside` sit above the board — usually a caption and a `StatusFlap` reading LIVE.

- It is a real `<table>` with `<th scope="col">` headers; each cell carries its text for assistive tech.
- On phones, drop secondary columns (Via) and set `size` to 16 so it fits without scrolling. It scrolls horizontally rather than wrapping if it must.
