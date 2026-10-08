# UI revision plan — Phase 1 + hub

> **Revision 2 — black base.** Direction changed from "beige desk" to a **black room**: black canvas, coal cards, red as the only
> action colour, beige for long-form reading panels, secondary buttons and text, white for headings and numerals. Tokens below are
> the final ones (they supersede the beige-canvas values in §2–§3).

Palette (fixed by the brief): **red, black, white, beige.** Nothing else.

## 1. What's wrong today (the "AI-sloppy" tells)

| Tell | Where | Why it reads as generic |
| --- | --- | --- |
| Near-black navy + **gold gradient** + cyan accent | every Phase 1 screen | the default "cyber/heist" skin; three unrelated accent colours compete |
| Glassmorphism (`backdrop-blur`, translucent panels), coloured glows, `animate-pulse`, CRT scanlines | headers, cards, buttons | decoration standing in for hierarchy |
| **Everything in monospace**, uppercase, wide-tracked | labels, body copy, buttons, table cells | long text (briefs, hints, feedback) is hard to read; no typographic hierarchy |
| `rounded-2xl` on everything, pill badges everywhere | cards, chips, buttons | soft and samey, no structure |
| Emerald / rose / amber / purple status colours | results, hints, checks | five more hues outside the palette |
| 10 equal "G1…G10" chips | stage stepper | no grouping, no sense of where you are |
| A scrolling wall of one-size panels | stage screens | the thing you must *do* (submit) has the same weight as the reading |

## 2. Direction: "black room, paper on the desk"

Near-black canvas; content in **coal** cards with hairline borders; the one piece of long-form reading on a page (the brief) sits on a
**beige paper** panel so it reads like a document. **Red is the only colour that means "act here / look here"**: the current stage, the
primary button, the top rule of the working panel, errors. Success is *not* green — it is a beige check mark; the palette stays closed.

* No blur, glow, gradient, scanline, pulse. Motion: 120 ms colour transitions and one 4 px rise for results.
* Radius 2–4 px; no shadows, hairlines instead.

## 3. Tokens

| Token | Value | Use |
| --- | --- | --- |
| `ink` | `#0D0B0A` | page canvas, text on beige |
| `coal` / `coal-2` / `coal-well` | `#161210` / `#1F1A17` / `#0A0807` | cards / raised & hover / inputs and code wells |
| `rule` | `#352D27` | hairlines |
| `beige` (+ dim `#A89A88`, faint `#7A6D60`) | `#E9DFCB` | body text, paper panel, secondary buttons |
| `white` | `#FFFFFF` | headings, numerals |
| `red` (hover `#B22B21`, text `#F0624F`, tint `#3A1512`) | `#D2362B` | fills (white text ≥ 4.9:1); `red-text` for red type on black (≥ 5.5:1) |

## 4. Type

* **Display:** Fraunces (600) for page and stage titles, big numerals (scores, stage numbers).
* **UI/body:** Public Sans 400/500/600 — briefs, hints, results, forms. Sentence case; uppercase only for 11 px section labels.
* **Code:** JetBrains Mono — *only* in code editors, terminals and file names.

## 5. Components

1. **Header:** black bar with a 3 px red top rule; wordmark left; **stage stepper** = two labelled groups ("Heist 1–5", "Arena 6–10") of numbered ticks (done = beige check, current = red fill, locked = faded); score as a Fraunces numeral; text buttons, no icon-in-box.
2. **Stage screen:** left column = reading (title, meta line, brief, handout button, hints); right column = doing (submission). Primary button is the only red filled element on the page. Results: one summary line, then a ruled table of checks (✓ / ✗, points).
3. **Modals (dashboard, leaderboard, admin):** same card + hairline-table treatment; leaderboard gets a sticky header and the user's row marked with a red left rule.
4. **Hub + login:** black/beige split panel; Fraunces headline; one red button.
5. **Legacy Royal Mint games (1–5):** inherit the new surface, type and colour tokens through the Tailwind theme (their markup stays), then spot-fix anything that looks wrong.

## 6. Implementation steps

1. Tokens in `tailwind.config.js` (palette, fonts, radius) and a rewritten `phase1/index.css`; Google Fonts in the page heads.
2. Re-map the legacy hex/Tailwind colour classes to tokens; strip blur, glow, gradients, pulse; `font-mono` → `font-sans` except code.
3. Rewrite Header, ChallengeStage, App shell/victory screen, Hub + login styles by hand.
4. Screenshot every stage (1–10), modals, hub and login; fix contrast and overflow; run the build and the API tests.

Out of scope: Phase 2 pages (their own stylesheet) — they keep their current look until you ask.
