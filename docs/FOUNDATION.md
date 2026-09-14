# Foundation provenance

- Adopted Foundation version: 0.10.0
- Copied-rule/template commit: `007352e15fcc6f9620686d3b77e11e85341eac02`
- Reusable workflow commit: `007352e15fcc6f9620686d3b77e11e85341eac02`
- Adopted on: 2026-09-14
- App-specific deviations:
  - Next.js App Router is used instead of the Foundation's Vite implementation baseline because the approved PoC architecture uses Next.js on Vercel; the Foundation explicitly permits Next.js when product architecture justifies it.
  - the bootstrap UI uses semantic native elements rather than importing a primitive library because no dialog/menu/form interaction currently requires one;
  - optional Fixed Staging is not adopted because the PoC has no stable non-Production origin requirement.

## Adopted guidance

The repository derives its working rules from Foundation v0.10.0, including:

- `AGENTS.md` read order, context routing, issue-driven development, approval boundaries, mandatory self-review, and independent-review policy;
- `docs/ai-implementation.md` for Chat-based implementation;
- `docs/ui-implementation.md` for primitive-first UI layering;
- `docs/ui-review.md` for rendered review;
- `docs/adoption.md` for consumer provenance and reusable CI;
- the default Vercel Git Integration and On-demand Preview profile.

## Hosting and deployment

- Vercel Git Integration owns web deployment.
- `vercel.json` disables ordinary branches, enables `main` for Production, and enables only trusted synthetic `preview/**` refs for non-Production hosted review.
- Fixed Staging is not adopted.
- Production credentials and privileged Azure state must not be made available to Preview PR code.

## Runtime baseline

- Node.js 24 LTS is pinned in `.node-version`.
- Next.js App Router + React + TypeScript + npm is the web runtime/tooling baseline.
- Tailwind CSS is the styling infrastructure.
- Generic shadcn/ui-style primitives are added only when an actual interaction requires them.

Copied rules/templates do not update automatically. Foundation upgrades must be deliberate and preserve app-specific product/design decisions unless the product owner approves a change.
