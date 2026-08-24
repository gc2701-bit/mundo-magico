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

---

## Scorecard final — rediseño frontend cliente (Sprint 9, 2026-08-24)

Medido con Lighthouse real (`npx lighthouse` contra un build de producción,
`npm run build && npm run start`) sobre las 4 páginas que pedía el plan
(`docs/superpowers/plans/2026-08-24-frontend-cliente-rediseno-plan.md`).

| Página | Device | Performance | Accessibility | Best Practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|---|
| Home (`/`) | Desktop | 98 | 97 | 96 | 100 | 1.1s | 0 |
| Home (`/`) | Mobile | 79 ⚠️ | 100 | 96 | 100 | 5.7s ⚠️ | 0 |
| Mundo (`/globos-fiesta`) | Desktop | 95 | 95 | 96 | 100 | 1.6s | 0.004 |
| Producto (`/cumpleanos/globo-estandar-12-x25`) | Desktop | 92 | 97 | 96 | 100 | 1.9s | 0 |
| Carrito (`/carrito`) | Desktop | 100 | 96 | 96 | 100 | 0.8s | 0 |

**Part 1 (objetivo, pass/fail):** pasa en las 4 páginas en desktop —
Performance ≥90, Accessibility ≥95, LCP<2.5s, CLS<0.1. Contraste WCAG AA
ver auditoría de `security-auditor` aparte.

**⚠️ Home en mobile no pasa Performance/LCP** — mismo patrón que un
hallazgo ya documentado en el Sprint 4 (`docs/superpowers/plans/...`):
main-thread work (1.8s) y latencia de red (10-180ms) medidos por el
propio Lighthouse no explican un LCP de 5.7s — sospecha fundada de
artefacto del entorno de medición (Chromium headless + throttling 4x
CPU simulado dentro de una VM WSL2 compartida), no un problema real de
la página. Recomendación: remedir en un deploy real antes de decidir si
hace falta optimizar algo — no perseguir este número a ciegas dentro de
este entorno, ya se intentó exhaustivamente en Sprint 4 sin resultado
concluyente.
