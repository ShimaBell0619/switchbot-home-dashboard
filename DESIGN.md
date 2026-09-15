---
version: alpha
name: SwitchBot Home Story
description: Mobile-first UI and UX contract for reading what changed in the home today.
omitted:
  - section: navigation
    reason: Home Story v0.1 intentionally has one primary surface; trend/device/scene navigation is deferred until those experiences exist.
  - section: charts
    reason: Home Story v0.1 prioritizes narrative events and calm-day ranges over graph-heavy analysis.
---

# Design System

## Overview

Design direction: **a quiet daily story that answers "今日、家で何が起こったか？" with the smallest useful amount of sensor information.**

The interface is not a traditional IoT dashboard. It should feel like a precise personal log: restrained, fast to scan, and confident enough to leave empty space when nothing important happened.

Information priority:

1. one short factual summary for today;
2. freshness / last-observation meaning;
3. a chronological sequence of 0-4 meaningful events;
4. when there are no meaningful events, a calm-day statement plus compact observed ranges;
5. implementation/debug metadata only when needed to explain an unavailable state.

## Mobile-first composition

The primary surface is a vertically scrolling reading column.

```text
Home

今日は空気に変化がありました
最終観測 19:35 · 3分前

今日

19:35
CO₂が急低下
1,120 → 620 ppm

22:10
今日の最高CO₂
1,041 ppm

今日 42件の観測から生成
```

Do not reserve empty slots for events. A quiet day may be materially shorter than an eventful day.

Desktop retains the same focused column with increased surrounding whitespace; it does not expand into a multi-column admin dashboard.

## Story semantics

- Timeline text must describe observed facts, not inferred causes.
- `CO₂が急低下` is allowed when supported by readings.
- `換気した`, `帰宅した`, `就寝中` or similar causal/context claims are not allowed without another data source proving them.
- Time-of-day wording derived directly from timestamps is acceptable.
- A calm day is a positive valid state, not an empty state.
- No-data, stale, and backend-error states must be written distinctly from calm-day copy.

## Colors

- Use the existing neutral background, foreground, muted-text, and border roles as the default visual system.
- Keep the timeline marker neutral in v0.1; do not create a rainbow metric legend without a real need.
- Semantic warning/error color may be introduced later, but status meaning must always be written in text.
- No decorative gradients, glowing charts, photo backgrounds, or lifestyle illustration.

## Typography

- Use the system sans-serif stack with explicit `Noto Sans JP` fallback.
- The daily summary is the strongest type on the page.
- Event titles are secondary, event values/details are readable body text, and timestamps/metadata are visually subordinate.
- Use tabular numerals for timestamps and sensor-value transitions where practical.
- Japanese copy should remain concise and natural; avoid AI-like explanatory paragraphs.

## Layout and spacing

- Target a narrow reading column (`max-width` roughly 36-40rem) even on desktop.
- Mobile horizontal padding must remain comfortable at approximately 390px and usable at 320px.
- Prefer generous vertical whitespace and thin separators over cards and shadows.
- A single subtle vertical timeline line and small dot are sufficient to establish chronology.
- No unintended horizontal overflow is acceptable.

## Surfaces and shapes

- Default content sits directly on the page background.
- Use borders/dividers for structure before introducing bounded cards.
- Calm-day ranges may use a simple divided definition list.
- Avoid pills, icon boxes, oversized radii, and nested surfaces unless a future interaction justifies them.

## Components

Tailwind CSS remains the styling infrastructure. Semantic native elements are sufficient for v0.1:

- `main`, `header`, `section`, `ol/li`, `time`, `dl/dt/dd`, and text elements;
- no component library is required for the current non-interactive story surface.

Future `今日 / 傾向` switching should not be built until the trend content and interaction contract are approved.

## State behavior

### Eventful day

- show the daily summary;
- show freshness;
- show 1-4 selected story events chronologically;
- do not append low-value rows simply to fill space.

### Calm day

- show the calm summary;
- state that there was no large change;
- show only available daily ranges (CO₂ / temperature / humidity).

### No data / failure

- no data: explicitly say today's observations have not arrived yet;
- stale: show the stale meaning beside last observation time;
- backend error: explain that the stored-data path could not be read;
- never translate any of these into `穏やか` or another valid-sensor judgment.

## Do's and Don'ts

### Do

- let chronology and typography carry the experience;
- allow the page height to vary naturally with event density;
- keep sensor transitions concise (`742 → 510 ppm`, `+1.3℃`);
- validate rendered UI at approximately 1440px, 390px, and 320px, including Japanese wrapping and semantic status;
- keep the browser read path independent of SwitchBot latency.

### Don't

- do not copy the SwitchBot app's visual language;
- do not create an equal KPI-card grid;
- do not add decorative hero imagery or wellness-style marketing copy;
- do not add charts merely because time-series data exists;
- do not invent a fixed daily event count;
- do not add navigation for future experiences before those experiences exist.
