---
title: Forward only
date: 2026-11-25
tags: solari, mechanics
summary: A split-flap cell never jumps. It steps through its drum until it lands - and that rhythm turned out to be the whole brand, and the source of its first bug.
---

On a real Solari board every character is a printed card on a drum. To go from B to A, the drum does not reverse. It turns forward through every card - C, D, E, all the way round - until A comes up again. That is the clatter you hear in a station hall.

SOLARI copies that exactly. The drum is a fixed order: a space, A to Z, 0 to 9, then punctuation. A cell only ever steps forward, one card every seventy milliseconds, with a small delay per cell so a change ripples left to right.

## The first bug

The first version of the hero cycled its messages on a plain timer: a new message every 4.2 seconds. It sounds fine. It was not.

A cell that has to travel most of the drum takes about three and a half seconds to land. With that timer, the message landed and immediately started flipping away again. On the live site the board was almost always in motion and almost never readable.

> The timer was measuring the wrong thing. It counted from when a message started, not from when you could read it.

## Hold after landing

The fix was to work out how far each cell has to travel, take the slowest one, and only start the hold once the whole board has settled. Every message now stays up for its full hold time, however far the drum had to turn to get there.

It is a small change, but it is the difference between a board that shows off and a board that tells you something.
