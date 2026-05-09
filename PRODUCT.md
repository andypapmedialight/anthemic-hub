# Product

## Register

brand

## Users

- **Potential clients** evaluating whether to hire you for web or related services—often skimming quickly on a laptop or phone.
- **Employers and agencies** checking credibility, range of work, and seriousness before outreach.
- **Bass students** (and their parents or schools) looking for lessons, resources, or booking—when the bass coaching surface goes live.
- **Peers and collaborators** who want a single trustworthy entry point to what you ship under Anthemic Developments.

They arrive with different intents but share a need: *fast orientation*—who you are, what exists today, and how to take the next step.

## Product Purpose

**Anthemic Hub** is the root site for **anthemic-developments.com**: a brand-forward directory of your public work and affiliations. It exists so visitors can (1) **open current projects** with minimal friction, (2) **build enough confidence in you** that employers and agencies feel comfortable starting a conversation, and (3) **reach you** via a clear contact path (the UI should make that obvious once the personal site or contact block ships; until then, strategy still treats contact as a first-class success outcome).

Success looks like: someone finds the right card in one scan, understands what Anthemic is, and leaves having either used a tool or initiated contact.

## Brand Personality

**Capable, direct, craft-led.** The voice is calm expert—not hype, not stealth-mode mysterious. The interface should feel like a **workshop with the lights on**: ordered, intentional, and slightly warm in a dark-neutral shell. Emotional goal: *trust through clarity* (visitors believe the work is real and maintained).

Reference lane: **quiet tech craft** (Stripe-level restraint without copying Stripe’s visual language)—strong hierarchy, generous spacing, no gimmicks.

## Anti-references

- **Generic “AI SaaS” marketing pages**: purple gradients, glassmorphism stacks, interchangeable hero metrics, fake urgency.
- **Portfolio theatre**: endless identical case-study cards with buzzwords and no working links.
- **Loud personal-brand energy**: meme density, chaos layouts, or novelty that competes with the actual project links.

## Design Principles

1. **Projects first** — The primary job of the page is navigation to live work; everything else supports that scan path.
2. **Earned credibility** — Employers and agencies should infer seniority and reliability from structure and copy, not from claims alone; show what’s live and what’s coming honestly.
3. **One surface, many audiences** — Copy and IA should not optimize for a single persona at the expense of others; use clear sections (e.g. projects vs work vs related) instead of blending intents.
4. **Contact is completion** — A visit is not successful until a motivated visitor knows how to reach you; preserve space and priority for that path as it is implemented.
5. **Maintainable modesty** — Static HTML/CSS is a deliberate constraint; design choices should stay easy to edit in one file without a build step.

## Accessibility & Inclusion

- Target **WCAG 2.1 Level AA** for text contrast, focus visibility, and keyboard operability (including card links and disabled placeholders that must not trap focus confusingly).
- Support **zoom and reflow**; the layout already uses responsive grids—keep touch targets comfortable on phones.
- **Motion**: keep transitions subtle; respect `prefers-reduced-motion` if motion is expanded later.
- No known specialized AT requirements beyond standard semantic HTML and visible focus states.
