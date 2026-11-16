# Pre-production audit — 15 November 2026

## Verified in this pass
- 52 authenticated administrator route openings, no redirects, page exceptions or failed requests during each observation window. This is an opening/read sweep, not proof of every operation or role.
- 113 test suites / 511 tests pass. Test execution used a temporary preload that disables the unavailable optional native canvas binding; pixel rendering is verified in Chromium instead. LINE Vault server tests explicitly use Node so Blob.arrayBuffer matches the deployed runtime. An initial parallel PGlite timeout passed with two workers; it was not an application defect.
- Leave and inbox failure/retry flows exercised with real signed-in session and selectively intercepted read failures. Denied read displays error; retry reads existing school data. Mobile 390×844 has no document overflow or page errors.
- Inbox mark-all denied-write path shows SweetAlert error, not success. Writes intercepted before reaching Cloud; no school records/files/users were created or modified in this audit.
- Preview build OK after edits.

## Confirmed defects fixed
- Leave query failures previously displayed zero requests / no pending requests. All profile, linked personnel, active personnel, schedule, classroom and leave reads now propagate errors and gate list/actions; retry does not erase drafts.
- Leave duplicate pre-check errors no longer permit insertion. Revoke/delete require returned rows before declaring success.
- Inbox and notification history no longer stop silently at 200 records. Both readers page deterministically; failure cannot display “no messages” or “all read”. Mark/read-all/delete failures surface errors and refresh caches; individual targeted writes require returned rows.

## Security review limits
- Persisted scan results were stale (deep scan from 11 November and database scan from 14 November). Remaining database findings were 19 informational read/list exposure notices. No finding was fixed/ignored/reclassified in this pass; the earlier explicitly selected-finding scope is preserved.
- Current automated database linter: 186 flags (2 locked tables without policies, 58 anonymous and 126 authenticated SECURITY DEFINER execute notices). Execute notices require inspection of each function's internal authorization and intended public use, not blanket revocation. Linter output does not establish 186 exploitable bugs or a clean security posture.

## Not yet release-certified
- Teacher/student/parent separate-role write/readback for modules outside the previously verified homework flow.
- Actual Drive content+rename readback, real LINE/push reception, scheduled next-day delivery, iOS/Android capture and login retention.
- Current Windows/Android CI artifacts installed on school hardware; two real kiosks synchronization, doors/camera/speaker.
- Homework shared JSON concurrent submission/grading/reply review remains open from the prior audit.
- Security deep rescan and per-function intended-access review remain outside this pass; stored results are not current.

Recommendation: limited pilot with verified accounts/devices, not an assertion that the entire school system is bug-free.
