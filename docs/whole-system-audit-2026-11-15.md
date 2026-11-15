# Whole-system follow-up — 15 November 2026

## Verified scope
- Opened all 179 static dashboard routes using the existing authenticated session at 1280×1800. No page exceptions or JavaScript page errors observed. Eighteen redirects were existing consolidated-page destinations, not failed page openings.
- Final regression run: 115 suites, 518 tests passed. Used the temporary optional-canvas preload from the previous audit; this does not certify canvas pixels. Chromium verified the changed flows separately.
- Latest preview build after corrections: build OK.

## Fixed
- Shared homework JSON writes now re-read and compare the exact prior JSON before updating. Collisions retry against the new value, preserving other students and replies. Teacher grading rejects a changed same-student submission instead of applying a stale grade.
- Teacher grade/return/comment success appears only after server-confirmed writes; failures preserve form contents and release the busy state. Switching students remounts the grading draft, preventing the previous student's score/feedback from carrying over.
- Teacher submission roster reads all pages, rejects failed reads and offers retry.
- Academic probation previously treated each subject grade as a student's GPA and used student codes as UUIDs, causing duplicated rows and broken updates. It now joins actual student UUIDs, computes one credit-weighted term GPA using the shared academic formula, preserves original score records, pages every read, blocks incomplete data, confirms writes and keeps failed edits open.
- Probation defaults to the shared school calendar, retaining manual year/semester selections. The selected-term metric is labeled GPA, not cumulative GPAX.
- Server-clock sync uses the supported GET health request rather than HEAD (405), and never accepts the Date header of an error response.
- Kiosk setup resolves scanner downloads through the verified release manifest instead of the missing latest APK alias; absent verified releases leave downloads disabled.
- Members page presents failed roster reads with retry instead of displaying an empty successful directory.

## Real write verification and cleanup
- Created one distinctly labeled temporary homework task through the authenticated client; used existing student/class references without changing their records or creating accounts.
- Two simultaneous real reply writes both persisted and read back.
- Intercepted a grading PATCH as denied: the UI displayed the error without announcing success. Restored network writes, assigned score 7, and read score 7 back from the saved submission and UI.
- Deleted the exact temporary task and notifications referencing its UUID; confirmed zero remaining task rows. No uploaded files or new accounts were created. No real score, attendance or roster record changed.
- Probation read denial blocks empty-result presentation; retry reads real data successfully. At 390×844 there was no document horizontal overflow. Clock/scanner setup rechecks had no failed responses or page errors.

## Remaining release blockers and limitations
- BigData warehouse fact_attendance/fact_grades/fact_finance tables are absent in the managed backend. Their reads return 404 and the existing page exposes warehouse failure rather than invented zeros. Repair requires reconciling the warehouse schema/ETL design; no placeholder data or replacement tables were invented in this pass.
- Three member avatar references point to missing stored objects. Initials remain visible. Original media is needed to recover the photos; no replacement image or deletion of references was performed.
- LINE Vault fetch warnings during rapid page navigation were observed; this pass did not recover unavailable original files.
- Existing scan results are stale. No findings outside the earlier explicitly authorized IDs were fixed, ignored or marked fixed, and no new deep scan was started without an explicit security-scan request.
- Route opening is not role-by-role workflow certification. Student/parent/director write flows, real Drive save/rename readback, actual push/LINE reception, physical APK/Windows installer operation and two school kiosks remain dependent on appropriate accounts, connected services, CI and physical devices.
- Compare-and-swap protects updated homework client paths; it does not certify retired clients or every other shared JSON writer. Existing server-side authorization remains unchanged.

## Release position
The verified fixes and cleanup are complete for this pass. The system is not certified bug-free or cleared for unrestricted production rollout while the listed blockers remain.