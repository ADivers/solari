---
title: One canvas, fifteen hundred flaps
date: 2026-11-25
tags: solari, performance
summary: How a page that is nothing but a departures board stays smooth - and still works for a screen reader and a keyboard.
---

The board experiment asks a slightly silly question: what if a website had no text, no images and no layout - only flaps? A laptop screen holds about fifty columns and twenty-odd rows of them. That is well over a thousand cells, any of which might be flipping at once.

## Why not one element per flap

The SOLARI components draw each flap as a few nested elements with a CSS animation. That is lovely for a twelve-letter headline. For a full screen it means thousands of elements re-rendering every few frames, which is exactly how you get a page that stutters.

So the full-page board is a single canvas. Each cell is just a few numbers: the card it shows, the card it is heading for, and when its current flip began.

## Draw only what moves

Every frame, the engine walks the cells and redraws only the ones that are mid-flip. A flip is two halves: the top of the old card folding down towards the hinge, then the bottom of the new card dropping into place, each squashed toward the split line and shaded as it turns. When nothing is moving, nothing is drawn.

A full page change - every cell on screen moving - runs at a steady sixty frames per second.

## The words are still real

A canvas is a picture, and a picture is useless to a screen reader. So every page is also written out as ordinary text in the document, visually hidden, with real links you can reach with the tab key. The board is what you see; the text underneath is what the page actually says.
