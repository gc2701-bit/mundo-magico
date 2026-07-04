# Design Rubric

**Purpose:** This is the target for "high-end." Don't guess whether the site looks premium — screenshot it and score it against this.

## How to use this (the loop)

1. Build or change the page.
2. Take a screenshot of the rendered page (desktop AND mobile).
3. Score every craft dimension below 1–5 **from the screenshot**, not the code.
4. For anything scoring under 4, name the exact fix and apply it.
5. Repeat until Part 1 passes and Part 2 is mostly 5s.

**Rule for Claude:** Do not tell me it looks good. Find what's mediocre and say so. If you can't see a screenshot, ask for one — do not score from code alone.

---

## Which bar am I aiming at?

"High-end" is not one thing. State the target before scoring, or you'll average into something bland.

- **Mundo Mágico** → immersive, playful, brand-forward. Bar: Awwwards / Godly-tier showcase sites.
- **Argenfoods** → B2B food. High-end = appetizing + trustworthy + fast. Bar: Stripe-clean, or a sharp DTC food brand.

> Target for THIS page: `___________`

---

## Part 1 — Objective (pass/fail, non-negotiable)

- [ ] Lighthouse Performance ≥ 90
- [ ] Lighthouse Accessibility ≥ 95
- [ ] LCP < 2.5s
- [ ] CLS < 0.1
- [ ] INP < 200ms
- [ ] Body text contrast ≥ 4.5:1 (WCAG AA)
- [ ] No horizontal scroll on mobile
- [ ] No layout shift on load
- [ ] All spacing on one scale (e.g. 8px grid)
- [ ] All type on one ratio (e.g. 1.25)

If any box is unchecked, the page is not done — fix before scoring Part 2.

---

## Part 2 — Craft (score 1–5, high-end = mostly 5s)

| Dimension | 5 (high-end) | 2 (mediocre) | Score | Fix if < 4 |
|---|---|---|---|---|
| **Typography** | Confident scale, ~60–75 char line length, real hierarchy | Default fonts, everything similar size | | |
| **Spacing & rhythm** | Generous, consistent whitespace | Cramped or random gaps | | |
| **Color discipline** | Restrained palette, every color intentional | 6 competing colors | | |
| **Hierarchy** | Eye knows exactly where to go first | Flat, no focal point | | |
| **Motion** | Subtle, purposeful, good easing | None, or gratuitous | | |
| **States** | Hover / focus / empty / loading / error all handled | Only the happy path | | |
| **Responsiveness** | Redesigned per breakpoint | Desktop squished onto mobile | | |
| **Copy** | Tight, confident, human | Filler / AI mush | | |
| **Distinctiveness** | Has a point of view | Looks like a template | | |

---

## Prompt to trigger the review

> Screenshot the page (desktop + mobile). Score it 1–5 on every craft dimension in DESIGN_RUBRIC.md. For anything under 4, name the exact fix. Confirm Part 1 passes. Do not tell me it looks good — find what's mediocre.
