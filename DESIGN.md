---
version: alpha
name: SwitchBot Home Dashboard
description: Minimal UI and UX contract for the SwitchBot architecture proof of concept.
omitted:
  - section: components
    reason: The PoC has not demonstrated a repeated product component pattern yet.
---

# Design System

## Overview

Design direction: **a quiet sensor-reading surface where the latest observed value and its observation time are immediately legible, while architecture/debug information stays secondary.**

The primary task is confirming stored sensor state and recent history. The initial UI must not resemble a generic KPI dashboard or spend visual complexity on capabilities that the PoC is not testing.

Information priority:

1. latest stored environmental reading and observation time;
2. recent history needed to prove persistence and retrieval;
3. collection/API health or staleness evidence;
4. implementation/debug metadata only when it helps validate the PoC.

The PoC uses a light appearance only. Dark/system appearance is intentionally deferred until the product moves beyond architecture validation.

## Colors

- Use neutral background, foreground, muted-text, and border roles.
- Introduce semantic success/warning/error roles only when live collection states exist.
- Never use color alone to indicate stale, failed, or healthy collection state.
- Decorative gradients, glows, and unrelated accent colors are out of scope for the PoC.

## Typography

- Use the system sans-serif stack with an explicit `Noto Sans JP` fallback for Japanese/CJK content.
- Latest sensor values may receive stronger size/weight than labels and timestamps.
- Metadata and debug evidence remain visually subordinate.
- Avoid clipped fixed-height labels; representative Japanese text must wrap naturally.

## Layout

- Prefer a single reading flow over an equal-card dashboard grid.
- Keep content width constrained on desktop rather than stretching sparse PoC content edge to edge.
- On narrow screens, preserve the order latest state -> history -> health/debug evidence.
- Do not hide essential state behind hover-only interaction.
- No unintended horizontal overflow is acceptable at the Foundation review baselines.

## Elevation & Depth

- Use spacing, borders, and surface contrast before shadows.
- Add a distinct surface only when it clarifies grouping or interaction.
- Avoid nested card-on-card composition for sparse PoC content.

## Shapes

- Use a small, consistent radius vocabulary only where a bounded surface/control needs it.
- Avoid pills, icon boxes, and circular decoration without semantic meaning.

## Components

The Foundation primitive-first profile applies. Tailwind CSS is the styling infrastructure. Add shadcn/ui-style accessible primitives only when a real control such as a dialog, select, menu, or form requires them; native semantic elements are sufficient for the bootstrap page.

Product-specific components should emerge only from repeated real sensor/history behavior.

## Do's and Don'ts

### Do

- Make latest data and observation time the first-glance information once live data exists.
- Display stale/error meaning in text as well as any visual cue.
- Keep architecture/debug evidence available without letting it dominate normal reading.
- Validate material UI changes at approximately 1440px, 390px, and 320px, including keyboard focus and Japanese wrapping.

### Don't

- Do not copy the SwitchBot app's visual language.
- Do not create equal KPI cards for every field merely to fill a dashboard.
- Do not add charts, motion, gradients, or rich controls before an Issue requires them.
- Do not treat the bootstrap placeholder as the final dashboard composition.
