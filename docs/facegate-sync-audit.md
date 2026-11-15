# FaceGate synchronization sweep

Rule: the same captured scan must retain its identity, Bangkok date/time and entry/exit direction across devices, retries and reports. A locally queued scan is not a Cloud receipt. Settled records and permissions remain unchanged.

## Sources checked and outcomes

| User-facing flow | Source | Outcome |
|---|---|---|
| Windows/Linux native face and card QR scanning | agent.py, scan_outbox.py, scan_state.py | Durable queue before acknowledgement; one uploader; confirmed student receipts now included in sync; day-scoped local cooldown |
| Native recent list and screensaver | local_ui.py, kiosk-api recent/today-stats, saver_stats.py | Reads Cloud evidence periodically; displays pending status separately; shared public aggregation retained |
| Native staff scans | kiosk-api attendance | Stable capture-derived receipt ID prevents retry duplicates without a schema change |
| Face/QR/manual browser scan tab | FaceScanTab.tsx | Original corrected time persisted; complete history refreshed every 30 seconds, focus and reconnect |
| Tablet/browser kiosk and network-camera callbacks | FaceKioskPage.tsx | All student callbacks share durable enqueue before local feedback; corrected capture time; receipt list polling fallback; source errors block exit-time checks |
| Mobile staff QR/manual | MobileQrScanPage.tsx | Same captured timestamp online and offline; duplicate lookup failure remains blocking |
| Browser pending queues | offlineQueue.ts, offlineScanQueue.ts, scanDedup.ts | Unknown timestamps stay unresolved; original dates retained; historical uploads do not mark today's cache; listeners cleaned up |
| Failed-write retry screen | FailedScanQueue.tsx | Validates original time before retry; clears cache after receipt; old unknown-time items are not relabelled |
| School homepage / prominent teacher card | public-school-attendance, publicAttendance, dashboardAttendance | Existing paged evidence and shared digest retained |
| Homeroom dashboard | TeacherDashboard.tsx | Uses shared digest and school late threshold instead of divergent scan-only classification |
| FaceGate detail report / chart | FaceReportTab.tsx | All scan reads paged; chart polls; status resolution matches shared digest and preserves saved school attendance |
| Parent view | ParentAppPage.tsx | Reconciles only attendance/scans every 30 seconds; read failure is not empty success; Bangkok display time |
| LINE check-in | LiffAttendancePage.tsx | Re-reads current evidence before save, polls new receipts, uses registered capture-day term and never deletes settled rows |
| Academic attendance import | PP5AttendanceMatrix.tsx | Complete successful reads required; saved academic attendance is not deleted by gate evidence |
| Student summary | StudentSpiderDialog.tsx | Polling and explicit scan-read error instead of false empty history |
| Legacy daily report | face-scan-daily-report | Paged entry/assembly and saved school attendance; shared digest / check-in closure; no absence invented from exit-only evidence |
| Legacy period report | face-scan-summary | Same digest; complete reads; term dates from registered calendar; unknown gender not guessed |
| Main scheduled digest | notify-attendance-digest | Existing shared digest/paged reads retained; previously delivered reports not resent |
| Warehouse / OneStop / LINE history | bigdata-warehouse-cron, onestop-api, line-webhook | Captured scan_date/scan_time retained; bounded history samples are not modified into full inventories |
| Database attendance bookkeeping | auto_attendance_on_face_scan | Inspected hosted trigger; now derives term from captured date and configured late threshold; ON CONFLICT DO NOTHING preserves settled attendance |
| Other database scan triggers | prevent_duplicate_face_scan, school identity, notify_on_face_scan, gchat_on_face_scan | Existing per-day uniqueness / school boundaries retained; notifications already use capture time; no permission or historical notification changes |
| Installer/release paths | package-facegate.sh, build-facegate.yml, FaceGate.iss, install.sh | Module packaging checked; 1.13.2 ZIP contains scan_state and scan_outbox; Windows EXE still requires CI release |

## Verification and limitations

## Live receipts (1.13.3)

### Follow-up flow sweep (1.13.4)

| Place read now | Rule outcome / action |
|---|---|
| Native agent / SSE / outbox / local UI | Fixed heartbeat and independent 15-second reconciliation, upload wake, stream error retention, Bangkok clock/day reset; unresolved old timestamp rows stay pending but do not block valid new scans. No remote speech/door actions. |
| Native recent / screensaver API | Shared student present+late totals now match class/homepage aggregation; staff totals count distinct people, not repeated passes. Scan snapshot precedes enrolled/profile fallback. Staff legacy direction remains unknown. |
| App root / global role Realtime | Shared bridge reconnects after failure, session identity changes, web focus/visibility and native resume; includes actual admin v3, director, student, teacher briefing query keys. Existing role hook remains for unrelated modules; no access changes. |
| Browser/tablet kiosk / face tab / QR queues | Serial/coalesced recent reads, captured Bangkok time, signed read-time scan photos; confirmed QR queue replays notify the same bridge including duplicate receipt responses. |
| FaceGate live admin / alerts / report | Latest committed scans, deterministic order and per-image fallback; report reads signed scan paths, alerts now refresh on shared receipt events. |
| Public homepage | Private student Realtime is unavailable anonymously; aggregate-only refresh every five seconds without granting private table reads; day selection follows midnight only when it still followed today. This is a polling fallback, not anonymous instant row delivery. |
| Teacher / admin / director / student dashboards | Inspected shared aggregation/attendance reads; live cache-key coverage repaired, no stored attendance/grades altered. |
| Parent / LINE check-in / spider view | Parent status now resolves saved school attendance + earliest entry using shared threshold, ignores exit-only evidence; LINE and spider retain shared receipt refresh/read-error handling. |
| LINE text history / Google Chat summary | Fresh read per request/job; fixed entry/exit label and source-error reporting; scan summary range uses captured scan_time, not upload created_at. Already sent messages unchanged. |
| OneStop / Big Data screen / warehouse | Today's OneStop read errors now fail instead of empty success, deterministic bounded sample; live screen refreshes attendance only, does not rerun ETL or other modules. Warehouse remains scheduled derived history, not a live scanner source. |
| Daily / period / 10:00 digests | Re-read code: shared digest, original capture date and fail-closed reads; scheduled/sent snapshots remain snapshots and are not resent on live events. |
| Personnel attendance / browser staff scan | Inspected time_clock/personnel attendance separately from native staff pass receipts. Their meanings are intentionally distinct; no conversion of gate passes to work attendance or role/settings changes. |
| PP5 matrix / certificates / printed documents | Explicit reads are up to date when requested; saved academic rows and generated/printed snapshots remain unchanged. |
| Database triggers / publication / existing policies | Read hosted functions and publication: captured term/time, per-day dedup and original notification time preserved. No DML, permission or notification resend changes. |
| Windows/Linux release | Rebuilt 1.13.4 ZIP; Windows EXE/physical kiosk rollout must still pass CI and installation. |

Public live latency fallback is at most the polling interval plus network/read time; no guarantee of synchronized screens while a device is offline. Physical cross-kiosk recognition/upload/display latency remains unverified.

- Device-authorized receipt-stream sends data-free SSE doorbells from committed student/staff receipts and attendance; receipt-state re-reads identity, original timestamp, freshly signed pictures and day-scoped duplicate keys. Keys are revalidated on stream rotation; no client gets service credentials or wider permissions.
- Native screens read the local receipt cache every 500ms (not the Cloud every 500ms), display a fresh receipt from another kiosk without replaying speech or opening doors, and refresh shared screensaver statistics when receipt revision changes. Requests uses one-byte SSE chunks to avoid buffered event delays.
- One app Realtime bridge refreshes attendance query caches and state-based scanner, parent and LINE views. The admin live page now lists the latest twelve committed student/staff receipts across kiosks; photos fail independently and timestamps display Bangkok time.
- Verified authenticated live page with one existing receipt and successful readback/retry, desktop/mobile layout, simulated two-screen name/time equality, targeted tests and compiled 1.13.3 ZIP. No synthetic attendance records were written. Physical two-kiosk latency and Windows release/install remain pending; offline kiosks cannot display unconfirmed scans from another offline device.

- 34 targeted Vitest and 18 Python tests passed; package compilation and ZIP module inspection passed; old native pending scans with unknown capture time stay queued for review instead of becoming today's scans.
- Hosted attendance trigger definition re-read after migration; no settled rows updated.
- Deployed kiosk-api, face-scan-daily-report and face-scan-summary.
- Public daily aggregate reads successfully from Cloud.
- Authenticated report check could not run: no injected session, no cached session, and self-mint has no matching account. No account chosen arbitrarily.
- Two physical kiosks and actual Windows/Linux installation remain unverified; code/package completion is not a claim that school devices already updated.