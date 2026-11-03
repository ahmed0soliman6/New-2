# SOLI MEDICAL — SECURITY TASKS MATRIX

> **Document Status**: Completed & Verified  
> **Linked Plan**: `docs/security/SECURITY-PLAN.md`  

---

| Task ID | Phase / Layer | Title / Description | Target Scope | Acceptance Criteria | Status |
|---|---|---|---|---|---|
| **TASK-001** | PHASE-001 (S7) | Escape all dynamic HTML/URLs in prescription & dossier print templates | `src/utils/printPrescription.ts`, `src/utils/exportPatientDossierPdf.ts` | All patient, clinical, and branding strings sanitized via `escapeHtml()` / `safeUrl()` before `document.write` | **COMPLETED** |
| **TASK-002** | PHASE-002 (S6) | Enforce strict financial bounds on invoice creation & discounts | `src/components/screens/FinanceScreen.tsx`, `src/components/finance/InflowPage.tsx` | Reject negative/NaN amounts, cap single invoice at `1,000,000`, enforce `discount <= totalAmount` | **COMPLETED** |
| **TASK-003** | PHASE-002 (S4) | Validate patient age & visit fee bounds in intake screen | `src/components/screens/PatientIntakeScreen.tsx` | Reject age outside `0–130` and fee outside `0–100,000` with clear Arabic feedback | **COMPLETED** |
| **TASK-004** | PHASE-003 (S3, S5) | Programmatic Admin guards on destructive handlers & Supabase delete verification | `src/App.tsx`, `src/utils/demoDataGenerator.ts` | Non-admin calls blocked in handlers; `clearAllDatabaseCollections` verifies `{ error }` on every table | **COMPLETED** |
| **TASK-005** | PHASE-003 (S4, S8, S9) | Enforce 64KB body cap & role allow-list on `/api/users/*` serverless endpoints | `api/users/create.ts`, `api/users/delete.ts`, `api/users/reset-password.ts` | Payloads `> 64KB` aborted with HTTP `413`; roles outside `admin \| doctor \| secretary` rejected with HTTP `400` | **COMPLETED** |
| **TASK-006** | PHASE-004 (S10, S11) | Remove legacy unmigrated Firestore seeding stubs & preserve default catalogs | `src/App.tsx` | No background throw-stub exceptions on startup; built-in catalogs preserved when cloud tables are empty | **COMPLETED** |
| **TASK-007** | PHASE-004 (S11) | Synchronize security documentation & verify zero-error build/typecheck gate | `docs/security/*` | `compile_applet` and `lint_applet` pass with 0 errors and all audit artifacts updated | **COMPLETED** |

---

## Task Summary
- **Total Phases**: 4 (`PHASE-001` – `PHASE-004`)  
- **Total Tasks**: 7 (`TASK-001` – `TASK-007`)  
- **Completed**: 7  
- **Pending**: 0  
- **Gate Status**: PASSED  
  
