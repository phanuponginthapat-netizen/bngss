# AGENTS.md
- The system is cloud-only (single hosted backend); standalone/self-hosted installers and the district hub were removed to keep the codebase focused on day-to-day school use.
- Database tables of removed modules (IoT, bus, district hub) are kept, only UI/functions removed — avoids data loss and lets features be restored later.
- Resolve existing Sonner imports to the shared SweetAlert adapter in Vite and Vitest, and render shared AlertDialogs with SweetAlert; preserve async decisions and queue background notices behind active confirmations.
- Share the work-area navigation catalog between the sidebar, department pages, and return links; keep existing protected routes and module toggles authoritative so regrouping never changes access or stored data.
