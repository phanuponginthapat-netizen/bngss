# Workspace move audit — 16 November 2026

## Verified without school-data changes
- Managed Cloud auth and database reachable. No backend rotation or rebinding was necessary.
- Seven active scheduled jobs target the current managed helper; 676 scheduler executions in the previous 24 hours report succeeded. Scheduler success alone does not prove downstream delivery.
- Secret-name inventory and boolean private-setting checks only; no secret values printed. LINE OA settings, Vault access token, FCM service account, VAPID pair and Google OAuth client remain configured in Cloud. Absence from workspace environment does not mean absence from private school settings.
- Google Search Console is linked in this workspace. One active renewable personal Google Drive connection remains in school storage; its runtime credentials were not tested in a signed-in session this turn.
- Push subscriptions retained: 36 webpush, 6 web, 1 FCM. This does not certify actual phone delivery.
- Six active kiosk devices; latest heartbeat was current during audit. FaceGate ZIP and Windows manifests report 1.13.4; scanner manifest reports build-10. Reading manifests does not certify installed software or CI credential agreement.
- Seven browser route checks: homepage, install, APK downloads, downloads, tablet scanner, protected Vault entry, protected FaceGate entry. No page exceptions; protected entries redirected to sign-in. Mobile install at 390px had no horizontal overflow.
- Invalid-session probes: LINE OA rejects unsigned events403; push rejects401; actual kiosk-api/sync path rejects missing device key401. The base kiosk-api endpoint is public health ping, not the sync route.

## Fixes shipped
- Vault receive/send/quota/recovery resolve saved Cloud credentials before stale environment values through shared getSecret.
- Both LINE quota reads require successful, structurally complete quota and consumption responses; provider failures cannot masquerade as zero consumption. OA delivery breakdown pages completely and rejects read errors.
- Vault missing-token and fatal failures no longer acknowledge successful receipt; admin-only status reports signature configuration without revealing it.
- Missing FCM credentials no longer remain cached for55 minutes; failed/skipped push configuration appears in returned errors instead of an empty failure explanation.
- Nine affected functions deployed; webhook redeployed after final status adjustment.

## Validation
- Full120 Vitest suites /533 tests pass. Optional native canvas was replaced by a temporary empty module during non-pixel tests; this is not drawing-pixel certification.
-19 Python scan tests and64 FaceGate tests pass; temporary OpenCV dependency enabled QR test coverage without changing project dependencies.
- Latest preview build OK. Server-only mock test dynamically loads its module to keep Deno imports out of web typechecking.
- No school record writes, synthetic scans, notification fanout, credential rotation, connection deletion or repository mutation.

## Not cleared
- Vault Channel Secret is absent: receive endpoint correctly returns503. Supply the original Vault OA secret through the Vault settings password field; do not reuse a different OA secret or bypass signature verification.
- No requesting-user Cloud account matched managed --self session mint. Authenticated LINE provider quota, Drive roundtrip, all-role write/readback and protected screens could not be verified this turn; needs signed-in preview or approved selected account.
- Physical phone delivery, LINE group receipt, camera/door/voice scan flow, multi-kiosk latency, latest APK installation and CI upload credentials require the corresponding accounts/devices.
- Existing critical identifier-only QR login risks remain decision-blocked; three missing avatar originals and legacy missing files remain unavailable. No replacement content invented.
- No blanket production-ready or bug-free certification.