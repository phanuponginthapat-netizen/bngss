# AGENTS.md
- District hub endpoints live inside the existing `district-feed-api` function under `/hub/*` (logic in `_shared/districtHub/`) — the canonical project is at its edge-function limit.
- Schools send only aggregate snapshots to the hub; the per-school ingest key is stored server-side in `app_secrets` and injected by the outbox worker at send time, never stored in the queue.
- In-school installs set `DEPLOY_MODE=standalone|hybrid` for edge functions; Drive offload/quota actions short-circuit because self-hosted storage already lives on the server HDD.
- Local installs (`VITE_STANDALONE=1` build or `DEPLOY_MODE` in `/app-config.js`) never fall back to the canonical backend or localStorage overrides — so a school's install can't touch the main system.
- Standalone service keys (LINE/AI/Google) live in `$STACK/keys.env` + local `app_secrets`, loaded via `school-set-keys`; data and files always stay on the server HDD.
