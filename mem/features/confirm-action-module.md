---
name: Confirm Action Module
description: Reusable confirm helpers (delete/save/create/update/submit/critical) in src/lib/confirmAction.ts wrapping swal.confirm — use before any destructive or important action
type: feature
---
Use `confirmDelete`, `confirmSave`, `confirmCreate`, `confirmUpdate`, `confirmSubmit`, or `confirmCritical` from `@/lib/confirmAction` before destructive/important DB writes. Built on `swal.confirm` so styling stays consistent (dark mode + Thai). `confirmCritical` requires typing a match string for irreversible actions (bulk delete, reset, etc.).
