# Container Apps cutover

Issue #15 replaces Azure Functions with Azure Container Apps without migrating application data.

## Sequence

1. Merge the implementation PR to trusted `main`.
2. On Issue #15, run `/deploy-azure`.
3. The trusted workflow publishes the immutable backend image, deploys the Container App and scheduled Job, manually runs the collector, and smoke-tests `/api/latest` and `/api/story`.
4. After the collector smoke succeeds, the workflow disables only the legacy Functions timer. The legacy Functions HTTP endpoints remain available as rollback for the web read path.
5. Change `vercel.json` to `AZURE_BACKEND_BASE_URL=<new Container App URL>` and deploy/verify the Vercel production UI.
6. After the production UI is confirmed against Container Apps, run `/cleanup-legacy-functions` on Issue #15.
7. Remove the transitional Functions source/workflow and `AZURE_FUNCTIONS_BASE_URL` compatibility fallback in a final cleanup PR.

## Rollback

Before step 6, rollback is intentionally simple:

- keep Vercel on the legacy Function URL if the new HTTP API is unhealthy;
- re-enable `collectSensor` on the Function App if the Container Apps Job is unhealthy;
- do not delete or recreate the Storage Account or either Table Storage table.

The same five-minute history identity is preserved, so a retry or temporary overlap cannot create a second logical row for the same device/five-minute bucket.

## One-time GHCR requirement

The deployment requires the backend image to be anonymously pullable so Container Apps does not need registry credentials. The workflow verifies anonymous pull before Azure deployment. If the first publish creates a non-public GHCR package, change the `switchbot-home-dashboard-backend` package visibility to public and rerun `/deploy-azure`.
