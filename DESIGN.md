---
name: Anthemic Hub
description: Landing page and project menu for anthemic-developments.com
colors:
  canvas-base: "#0f1216"
  canvas-glow: "#1a2230"
  surface-card: "#181d24"
  surface-card-hover: "#1f2630"
  text-primary: "#e7ecf2"
  text-muted: "#9aa6b2"
  accent-amber: "#f59e0b"
  accent-sky: "#38bdf8"
  border-default: "#232a34"
  border-hover: "#2c3543"
  external-label: "#cbd5e1"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(32px, 5vw, 56px)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  body-small:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  section-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.14em"
  badge-label:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.08em"
rounded:
  card: "14px"
  pill: "999px"
spacing:
  grid-gap: "20px"
  card-padding: "24px 22px"
  card-stack-gap: "10px"
  main-padding: "24px"
  header-block-y: "64px"
components:
  card:
    backgroundColor: "{colors.surface-card}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  card-hover:
    backgroundColor: "{colors.surface-card-hover}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-padding}"
  badge-default:
    backgroundColor: "rgba(245, 158, 11, 0.12)"
    textColor: "{colors.accent-amber}"
    rounded: "{rounded.pill}"
    padding: "3px 8px"
  badge-live:
    backgroundColor: "rgba(56, 189, 248, 0.12)"
    textColor: "{colors.accent-sky}"
    rounded: "{rounded.pill}"
    padding: "3px 8px"
  badge-external:
    backgroundColor: "rgba(148, 163, 184, 0.12)"
    textColor: "{colors.external-label}"
    rounded: "{rounded.pill}"
    padding: "3px 8px"
---

# Design System: Anthemic Hub

## Overview

**Creative North Star: "The Lit Workshop"**

This system implements the strategic line from PRODUCT.md: the interface should feel like a **workshop with the lights on**—ordered, intentional, and slightly warm inside a cool graphite shell. Density is **calm and scannable**: one hero message, then grids of equal-weight cards so projects read as inventory you maintain, not as marketing fiction.

The visual story is **ember-and-console**: a restrained amber accent (signals attention and “Anthemic” warmth in the mark) pairs with a cool sky accent reserved for *live* state, evoking a readout that something is running. Neutrals carry almost all surface area; color earns its keep on badges and the favicon lineage, not in full-bleed gradients.

The system explicitly rejects the vibe of **Generic “AI SaaS” marketing pages**, **Portfolio theatre**, and **Loud personal-brand energy**—as named in PRODUCT.md. No glass stacks, no purple-neon hero, no identical icon-title-blurb grids pretending to be depth.

**Key Characteristics:**

- Dark-first canvas with a single soft radial lift (ambient only, not a second layout system).
- System sans stack end-to-end; hierarchy from scale and weight, not from mixing display families.
- Cards as the primary interactive surface pattern (the whole hub is cards-as-routes).
- Motion is **state-only**: short ease on hover/disabled, no choreographed entrances.
- Static-file discipline: tokens live in `:root` as plain CSS custom properties in `index.html`.

## Colors

A **cool graphite foundation** with **two disciplined accents** (amber default, sky “live”, slate “external”)—color stays mostly in chips and strokes, not in page-wide washes beyond the subtle radial.

### Primary

- **Signal Amber** (#f59e0b): Default badge text and border tint; ties to the brand mark stroke. Use for “coming soon” and neutral status—warm signal without filling large fields.

### Secondary

- **Console Sky** (#38bdf8): Live / active project badge only. Rare on screen by design; when it appears it must mean *shipped and reachable now*.

### Tertiary

- **External Slate** (#cbd5e1 on rgba(148, 163, 184, 0.12) fill): Off-domain and external-link badges. Keeps outbound links visually cooler than in-domain live work.

### Neutral

- **Canvas Base** (#0f1216): Primary page background; anchor for the radial gradient.
- **Canvas Glow** (#1a2230): Radial gradient stop (top-left wash); never use as large flat panels without the base behind it.
- **Surface Card** (#181d24): Card resting background.
- **Surface Card Hover** (#1f2630): Card hover lift (tonal, not shadow-based).
- **Text Primary** (#e7ecf2): Body copy and card titles on surfaces.
- **Text Muted** (#9aa6b2): Supporting copy, section headings, footer—secondary but still AA-minded against dark surfaces.
- **Border Default** (#232a34): Card and badge borders at rest.
- **Border Hover** (#2c3543): Card border on hover.

### Named Rules

**The Two-Accent Orchestra Rule.** Amber and sky never compete at the same hierarchy level on one component: one badge, one role. Default / pending → amber family; live in-repo → sky; external → slate family.

**The No-Wash Rule.** Do not replace the canvas with saturated amber or sky fills. Large fields stay neutral; accents stay small.

## Typography

**Display / Body / UI Font:** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` (system UI stack only—no webfonts in the current file).

**Character:** Neutral, confident, and slightly technical—like documentation that happens to be beautiful. No editorial serif layer yet; if one is added later, it must not fight this stack for micro-labels.

### Hierarchy

- **Display** (700, clamp(32px, 5vw, 56px), ~1.15, -0.02em tracking): Single page H1 in the header; the only true display moment.
- **Title** (600, 18px, 1.35, -0.01em): Card titles; must stay clearly heavier than descriptions below.
- **Body** (400, 16px, 1.6): Header supporting paragraph; keep max width ~640px for comfortable measure.
- **Body small** (400, 14px, 1.55): Card descriptions; muted color, not muted weight below regular unless disabled state.
- **Section label** (400, 12px, 0.14em uppercase tracking): `h2.section-heading`—all caps via CSS, not by typing caps in content.
- **Badge label** (400, 11px, 0.08em uppercase tracking): Status chips; always uppercase via CSS.

### Named Rules

**The Measure Rule.** Marketing explanation in the header caps near **65ch** effective width (`max-width: 640px` today); card copy can run wider inside the card but should still avoid long unbroken lines in future edits.

## Elevation

**Flat surfaces, tonal hover.** Depth is conveyed by **background step** (#181d24 → #1f2630) and **border step** (#232a34 → #2c3543) plus a **1px lift** (`translateY(-1px)`) on interactive cards—not by drop shadows. The only atmospheric depth is the **fixed radial gradient** on `body`, which reads as environment, not as stacked paper.

### Shadow Vocabulary

None by design. If a future component truly needs elevation, introduce a **single** shadow token in the sidecar first; do not sprinkle ad-hoc `box-shadow` in `index.html`.

### Named Rules

**The Hover-Is-State Rule.** Motion and tonal change appear together on `:hover` for enabled cards; disabled cards must **not** lift or brighten on hover (opacity and `not-allowed` cursor only).

## Components

### Cards (primary pattern)

- **Character:** Tactile but quiet—rounded rectangles that feel like **labeled drawers** in a bench rack: same size in the grid, content stacks top-to-bottom (badge, title, description).
- **Corner style:** 14px radius on all corners (`border-radius: 14px`).
- **Background / border:** `surface-card` + `border-default`; hover moves to `surface-card-hover` + `border-hover`.
- **Padding:** 24px vertical, 22px horizontal (`24px 22px`).
- **Internal stack:** 10px gap between badge, title, and description (`flex-direction: column; gap: 10px`).
- **States:** Enabled link cards: 120ms ease transitions on background, transform, border-color; hover `translateY(-1px)`. Disabled placeholders: `aria-disabled="true"`, `opacity: 0.85`, `cursor: not-allowed`, hover resets to resting surface (no lift).
- **Focus:** Today the page relies on browser default focus for links; **add** a visible `:focus-visible` ring (see Do's) before shipping larger IA changes.

### Badges (status chips)

- **Shape:** Full pill (`border-radius: 999px`).
- **Default / pending:** Amber text on `rgba(245, 158, 11, 0.12)` fill with `1px solid rgba(245, 158, 11, 0.35)` border.
- **Live:** Sky text on `rgba(56, 189, 248, 0.12)` fill with sky-tinted border.
- **External:** Slate label on cool-gray translucent fill/border (`rgba(148, 163, 184, …)`).
- **Typography:** 11px, uppercase via CSS, wide letter-spacing (0.08em).

### Section headings

- **Style:** Uppercase section rails above grids; 12px, 0.14em tracking, muted text color; margin rhythm: first section pulls top margin in (`margin-top: 8px` on first-of-type), later sections use larger top margin before the label.

### Footer

- **Style:** Centered, 13px, muted color; links inherit muted color and use underline on `a`—keep contrast sufficient when adding real mailto/links.

## Do's and Don'ts

### Do:

- **Do** keep **≥** rough AA contrast for `text-muted` on `canvas-base` when you add new copy blocks; test with a contrast checker if you introduce new neutrals.
- **Do** preserve the **card-first** scan path: grids stay `repeat(auto-fit, minmax(260px, 1fr))` with **20px** gap unless a breakpoint audit says otherwise.
- **Do** add an explicit **`:focus-visible`** outline (e.g. 2px solid `accent-sky` with offset) on `.card` links before expanding keyboard paths—PRODUCT.md targets WCAG 2.1 AA operability.
- **Do** respect **`prefers-reduced-motion`** if hover translation or transitions grow beyond the current subtle move.

### Don't:

- **Don't** build layouts that read as **Generic “AI SaaS” marketing pages**—no purple gradients, **glassmorphism stacks**, interchangeable **hero metrics**, or **fake urgency** (PRODUCT.md anti-references, quoted).
- **Don't** ship **Portfolio theatre**: no endless identical case-study cards with buzzwords and no working links; every card must either navigate somewhere real or be honestly disabled.
- **Don't** chase **Loud personal-brand energy**: no meme-density layouts, chaos grids, or novelty effects that compete with project links (PRODUCT.md anti-references, quoted).
- **Don't** use **side-stripe accent borders** (>1px colored `border-left` / `border-right` on cards or lists) as a decorative pattern—full borders or tinted surfaces only (impeccable shared law).
- **Don't** use **gradient text** (`background-clip: text` with gradients) for headings or titles.
- **Don't** add **modal-first** flows on this hub; keep navigation flat and direct.
