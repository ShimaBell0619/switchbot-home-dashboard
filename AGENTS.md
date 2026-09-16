# SwitchBot Home Dashboard — Agent Instructions

Foundation-Version: 0.10.0

## Read order

Before a material change:

1. Read the Issue / approved request and Acceptance Criteria.
2. Read `PRODUCT.md`.
3. Read this `AGENTS.md`.
4. Apply `## Context routing` and read the union of matching contracts.
5. Read `README.md` when public/user/contributor usage is affected.

`docs/FOUNDATION.md` records the adopted Foundation revision. Current product behavior belongs in `PRODUCT.md`; UI/UX decisions belong in `DESIGN.md`; substantial technical boundaries belong in `docs/ARCHITECTURE.md`.

## Context routing

| Change area / condition | Required context in addition to the base route |
| --- | --- |
| Product design / UX | `DESIGN.md` |
| UI infrastructure | `DESIGN.md`, `docs/FOUNDATION.md` |
| Domain / data | `docs/ARCHITECTURE.md` |
| Integration / trust | `docs/ARCHITECTURE.md` |
| Architecture / platform | `docs/ARCHITECTURE.md` |
| Delivery / operations | `docs/FOUNDATION.md`, affected workflow/deployment contract |
| Foundation adoption | `docs/FOUNDATION.md`, target Foundation guidance/change notes |
| Local implementation / refactor | no additional contract unless another route is actually triggered |

Matching routes are additive. Do not create empty documents merely to fill a route.

## Implementation method

- Use the Foundation v0.10.0 context-routed Chat implementation method for material work: session-local Repository Context Packet, Design Intent, Implementation Map, coherent implementation batch, focused/full validation, self-review, correction, re-review, and final validation.
- Issue-driven development is the default. Use a short-lived branch from the observed base SHA and Conventional Commit-style PR titles.
- Prefer the smallest coherent implementation. Do not add generic IoT abstractions, event buses, repositories, state-management libraries, or provider adapters before the PoC needs them.
- The approved backend path is SwitchBot -> Azure Container Apps scheduled collector -> Azure Table Storage -> Next.js/Vercel server-side read -> browser. A different persistence provider, new external integration, device-control capability, authentication/authorization model, new sensitive data class, destructive migration, retention policy, or recurring-cost architecture change requires explicit approval.
- Never expose SwitchBot Token/Secret, Azure privileged credentials, or Table SAS values to browser code. Do not commit secrets.

## UI rules

- `DESIGN.md` is authoritative for hierarchy and visual direction.
- Use Tailwind as styling infrastructure and semantic native controls / accessible primitives for ordinary interaction.
- Add shadcn/ui-style primitives only when an actual common interaction requires them; do not add a component library merely to satisfy the profile mechanically.
- User-facing UI changes require render -> critique -> fix -> re-render.
- Review approximately 1440px desktop, 390px mobile, and 320px narrow, including overflow, Japanese wrapping, keyboard/focus, and semantic status.
- Do not imitate SwitchBot or generic SaaS dashboard composition.

## Integration and data rules

- Browser rendering must not depend on a direct SwitchBot Open API request.
- Browser code must not call Azure Table Storage directly; Table access belongs to the Next.js server runtime or approved Azure backend workloads.
- Treat SwitchBot as an external trust boundary: validate HTTP/API success separately from the API response body status and handle upstream failure without writing fabricated readings.
- Persist the upstream observation time when available; otherwise record the collector observation time explicitly. Do not silently replace stale upstream data with a fresh timestamp.
- Make collection idempotent for the chosen reading identity before increasing retry frequency or adding Webhooks.
- Keep the PoC data model limited to the environmental fields needed by the selected test device.

## Validation and review

The default quality contract is:

- `npm run check`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Material UI work also requires rendered validation. The final implementation pass is not completion: self-review the final diff against the Issue, Product contract, Design Intent, regressions, responsive/accessibility behavior, trust boundaries, data-integrity behavior, failure paths, and unnecessary complexity, then correct and revalidate.

Independent review is risk-based. Real external integration/persistence, privileged Azure/GitHub workflows, destructive/data-integrity behavior, authentication/authorization, release/deployment machinery, or comparable high-risk work should receive independent review when practical. `@codex review` is never invoked without fresh explicit maintainer approval.
