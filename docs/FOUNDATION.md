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
- `docs/azure-oidc.md` for GitHub Actions -> Azure OIDC trust boundaries;
- the default Vercel Git Integration and On-demand Preview profile.

## Hosting and deployment

- Vercel Git Integration owns web deployment.
- `vercel.json` disables ordinary branches, enables `main` for Production, and enables only trusted synthetic `preview/**` refs for non-Production hosted review.
- The production web app uses one committed public backend URL because this is a fixed single-environment PoC. The backend URL is an identifier, not a credential.
- The server-side target setting is `AZURE_BACKEND_BASE_URL`.
- Fixed Staging is not adopted.
- Production credentials and privileged Azure state must not be made available to Preview PR code.

### Azure PoC deployment

- Azure infrastructure and backend deployment are owned by `.github/workflows/deploy-azure.yml` after that workflow has landed on `main`.
- The workflow is triggered only by the repository owner's exact `/deploy-azure` comment on Issue #15; PR code cannot request Azure OIDC credentials merely by running CI.
- The deployment job receives `id-token: write` and `packages: write`; ordinary web/IaC/backend CI jobs do not.
- Azure authentication uses the already-proven shared GitHub OIDC deployment identity. The client ID, tenant ID, and subscription ID remain committed target identifiers rather than authentication secrets.
- `Azure/login` remains pinned to the reviewed immutable commit.
- The workflow builds one backend image, tags it with the trusted `main` SHA, publishes it to GHCR, deploys the Container App and scheduled Job through Bicep, manually exercises the collector, and smoke-tests read endpoints.
- The Docker image carries `org.opencontainers.image.source` to link the package to this repository. Container Apps requires the deployed image to be anonymously pullable; the deployment explicitly verifies that property before touching Azure.
- SwitchBot Token/Secret are never GitHub deployment inputs. Redeployments preserve them from the existing Container Apps Job secret store, mask the values, and pass them only as secure Bicep parameters.

## Runtime baseline

- Node.js 24 LTS is pinned in `.node-version`.
- Next.js App Router + React + TypeScript + npm is the web runtime/tooling baseline.
- Tailwind CSS is the styling infrastructure.
- The Azure backend uses the Node.js 24 container image for both a scale-to-zero Container App HTTP API and a five-minute scheduled Container Apps Job.
- The Container Apps Environment intentionally has no Log Analytics destination, VNet integration, ACR, or always-on minimum replicas for the PoC.
- Generic shadcn/ui-style primitives are added only when an actual interaction requires them.

Copied rules/templates do not update automatically. Foundation upgrades must be deliberate and preserve app-specific product/design decisions unless the product owner approves a change.
