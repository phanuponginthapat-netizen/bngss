# AGENTS.md
- District hub endpoints live inside the existing `district-feed-api` function under `/hub/*` (logic in `_shared/districtHub/`) — the canonical project is at its edge-function limit.
- Schools send only aggregate snapshots to the hub; the per-school ingest key is stored server-side in `app_secrets` and injected by the outbox worker at send time, never stored in the queue.
- In-school installs set `DEPLOY_MODE=standalone|hybrid` for edge functions; Drive offload/quota actions short-circuit because self-hosted storage already lives on the server HDD.
