---
title: A website made of discs
date: 2026-11-07
tags: flipdisc, design
summary: Before SOLARI there was Flipdisc - a design system built on the electromechanical flip-disc sign, and the question of how far one idea can stretch.
---

The first board was not a split-flap at all. It was a flip-disc sign: a black housing, a grid of round discs, and each disc showing either its black face or its lit face - white, or fluorescent orange.

The rule was simple. Everything on the page had to look like it could hang above a bus bay. Three colours used like a sign: black is the ground, white is information, orange is the signal. If everything is orange, nothing is.

## Circles all the way down

The signature display was built from plain CSS circles driven by a five-by-seven dot font. No images, no web fonts. A board of a thousand discs was a thousand spans and one stylesheet, and it flipped column by column, fourteen milliseconds apart.

That worked beautifully for a headline. It did not work for a whole page.

## Then the whole page

The next question was obvious: could the entire site be one board? A thousand DOM elements is fine. Fifty thousand is not. So the second version, DiscField, moved the discs onto a single canvas. Unlit discs became a free CSS pattern underneath, and the canvas only drew the discs that were lit or mid-flip.

> A still page does no drawing at all.

That idea - draw only what moves - is the one that carried straight over into the board you are reading now.
