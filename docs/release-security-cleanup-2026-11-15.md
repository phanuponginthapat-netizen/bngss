# Release security cleanup — 2026-11-15

## Completed
- Deep scan returned 17 findings; 14 code/permission issues were fixed and marked fixed, none ignored.
- Deployed drive-storage, kiosk-api, line-vault-webhook, notify-google-chat, calendar-ics, visitor-checkin, fill-pdf-template, system-update and backup-to-external.
- Migration0050 makes face identity depend exclusively on saved account linkage; duplicate-face lookup requires staff/service authority. SQL behavior regression passed.
- File writes enforce bounded base64 decoding, type/path limits, configured shared Drive folder and staff/service authority; kiosk snapshot accepts JPEG signatures only. Full image decoder certification is not claimed.
- LINE Vault validates raw-body HMAC before captures; admin health ping is authorized. Dedicated OA secret is absent; unsigned capture now fails closed503. Settings now provide secret entry; legitimate LINE receipt requires that original secret.
- Google Chat rejects unsigned requests before external sends; public visitor duplicates no longer modify existing faces or expose row identifiers.
- Calendar export uses caller RLS, complete pagination and private/no-store. PDF template reads/counter writes respect role/RLS; actual PDF fill is not newly certified.
- Config imports prevalidate server-owned table/conflict/field allowlists; protected settings/ownership/publishing fields are excluded. External backups reject non-core tables and fail rather than saving capped partial snapshots.
- AR attributes escaped and unsafe URL schemes/component delimiters rejected; physical tracking not verified.
- OneStop no longer uses removed district snapshots or missing petty_cash; complete source reads fail on errors. Live scores810 (previous limit500), actual kiosk_devices6; absent petty source is null rather than zero. UI shows unavailable petty source.

## Verification
- 118 suites / 528 tests passed (optional native canvas preload used; not pixel certification).
- Live authenticated browser: arbitrary user_roles bundle400; protected school_id field400; invalid Drive upload400; unsigned GoogleChat401; unsigned Vault503; calendar200; summary200. No school data written.
- BigData loaded UI screenshot verified, no page errors; most recent build OK.
- Original face function definitions were read; applied definitions confirmed and behavioral SQL tests passed.

## Not cleared
- Three critical QR/parent login findings: existing public UUID/student-code QR and code+DOB routes still issue sessions. DOB-free scanning can stay, but a secret revocable card credential is required; printed cards need replacement QR. No false fixed status and no unilateral outage introduced.
- app-downloads shared SELECT rule is intentional public release-file access for installers, not private per-user files; left active, not ignored or falsely marked fixed. Write rules were not broadened.
- Nineteen informational findings unchanged.
- LINE Vault secret must come from the dedicated OA; never reuse the chatbot OA secret.
- Missing original avatars, physical notification/scanner/mobile/CI checks and other-role workflow writes require originals/devices/account-specific verification. No full production certification.
