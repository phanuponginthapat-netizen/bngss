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