# WRONG_NUMBER — Full Journey (Workflow Engine → Leads Page → Exhaust)

## 0) WORKFLOW ENGINE (CONFIG)

- **TagFlow node**: `tagValue = "wrong_number"`, label/name = "Wrong Number". Allowed roles for apply: TELECALLER.
- **TagConfig** (system behavior):
  - `autoAction = "CLOSE"` (no callback)
  - `requiresCallback = false`
  - `closeReason = "WRONG_NUMBER"`
  - `exhaustPolicy`:
    - `markExhausted = true`
    - `exhaustReason = "WRONG_NUMBER"`
    - `seniorNotify = true` (optional)

If workflow has no tagConfig for wrong_number, backend uses the above as default.

**Tag must exist in DB:** The "Wrong Number" tag must exist in **Admin > Tags** (TagFlow table) with `tagValue = "wrong_number"` and `category = "call_status"` so it appears in the workflow tag list. To create it without re-running the full seed: run `npm run db:seed:wrong-number`. Or run full seed: `npm run db:seed`.

### RBAC (strict)

- **Apply Wrong Number**: **TELECALLER only** (same as No Answer model). TL/BM/Admin cannot apply Wrong Number tag.
- **Senior actions (Reopen / Reassign)**: **TL / BM / Admin only** via `POST /api/leads/:id/reopen`.
- **wrong_number TagApplication**: Stays **active** (currentTag shows wrong_number). Only **no_answer** (and other callback tags) are deactivated immediately.

---

## 1) TELECALLER ACTION (APPLY TAG)

### Where to show the Wrong Number button (UI)

| Location | How it shows | Notes |
|--------|----------------|-------|
| **Lead detail page** (`/leads/[id]`) | **AgentTagNavigation** (floating tag button). Expand → workflow ke sub-buttons me **Wrong Number** option. | Workflow engine me **Wrong Number** node add karo (tagValue = `wrong_number`, category = `call_status`). Button yahi se aata hai. |
| **TagModal** (fallback / manual tag change) | Agar kahi se "Apply tag" / "Change tag" open hota hai (e.g. AgentTagNavigation me tag nahi mila), to list me **Wrong Number** sirf **TELECALLER** ko dikhega. | RBAC: No Answer + Wrong Number dono TELECALLER-only in TagModal. |

**Recommendation:** Primary place = **Lead detail page** pe floating **Tag / call outcome** button (AgentTagNavigation). Workflow me Wrong Number node add karke button wahi dikhao.

- **API**: `POST /api/tag-applications/apply`
  - Payload: `{ leadId, tagFlowId, note? }`
  - RBAC: TELECALLER (or role allowed by workflow).
- Creates **TagApplication**: tagFlowId = wrong_number node, appliedById = telecallerId, callbackAt = null, isActive = true.

---

## 2) BACKEND BEHAVIOR (EXECUTE TAG CONFIG)

When tagConfig has `autoAction === "CLOSE"` and `exhaustPolicy.markExhausted !== false`:

1. **Lead state cleanup (full list)**
   - `Lead.callbackScheduledAt = null`
   - `Lead.callStatus = "WRONG_NUMBER"`
   - Optionally `Lead.status = "lost"` if tagConfig has `closeLeadStatus = "lost"`.
   - **LeadCurrentTagState** = wrong_number (via step 8 after apply).
   - **Current tag**: wrong_number TagApplication has `callbackAt = null`, `followUpAt` cleared (if any).
   - **Deactivate**: all active **callback** tags (no_answer etc.) → `isActive = false`. wrong_number tag stays active.

2. **Exhaust marking**
   - `Lead.isExhausted = true`
   - `Lead.exhaustReason = "WRONG_NUMBER"`
   - `Lead.exhaustedAt = now`

3. **Activity logging**
   - LeadActivity: `WRONG_NUMBER_MARKED` — "Wrong Number", description includes reason.
   - LeadActivity: `EXHAUSTED` — "Exhausted (Wrong Number)", description for senior action.

4. **Notifications (idempotent)**
   - Seniors (TL/BM/Admin): socket `lead:exhausted` **once** (if `exhaustPolicy.seniorNotify !== false`).
   - **Do not spam**: if lead is already exhausted with reason `WRONG_NUMBER`, do **not** notify again.

**Code**: `server/src/routes/tagApplications.ts` → `executeTagConfigBehaviors()` → branch `autoAction === "CLOSE"`.

---

## 3) LEADS PAGE DATA (GET /api/leads)

- Backend sets: `isExhausted = true`, `exhaustReason = "WRONG_NUMBER"`, `callbackAt = null`.
- **Role filter**: TELECALLER → exhausted leads excluded (hidden). TL/BM/Admin → included.
- **Bucket (single source)**: `getLeadBucket()` → **if `isExhausted === true` → bucket = EXHAUST always** (senior-only). Exhaust overrides Orange/Red/Green even if an old `callbackAt` exists. Telecaller’s four buckets never show Wrong Number leads.

---

## 4) WHAT TELECALLER SEES

- After apply: lead **disappears** from telecaller list (exhausted = hidden).
- No reminder, no popup, no retry.
- Telecaller buckets remain: Fresh, Orange, Red, Green (no Exhaust tab).

---

## 5) WHAT SENIOR SEES (EXHAUST BUCKET)

- **Bucket**: Exhaust (senior-only).
- **Card**: Badge "Wrong Number" (from `exhaustReason` or current tag); who marked + timestamp + note; no countdown.

**Senior actions** (via API / UI):

| Action | API / behavior |
|--------|-----------------|
| **A) Verify & close** | Keep exhausted; add note (e.g. "Verified wrong number"). Optional: move to Archived/Closed view. |
| **B) Edit number + reopen** | `PATCH` lead phone (if needed) + `POST /api/leads/:id/reopen` with optional `phone`, `assignedToId`, `note`. Clears isExhausted, exhaustReason, exhaustedAt, callStatus, callbackScheduledAt. Lead goes to Fresh for assigned telecaller. |
| **C) Reassign to other telecaller** | `POST /api/leads/:id/reopen` with `assignedToId: newTelecallerId` (and optional `note`). Same clear of exhaust state; lead goes to Fresh for new telecaller. |

**Reopen endpoint (mandatory)**: `POST /api/leads/:id/reopen` — **TL / BM / Admin only**.  
Body: `{ assignedToId?: string, phone?: string, note?: string }`.  
**Clears**: isExhausted, exhaustedAt, exhaustReason, callStatus, callbackScheduledAt.  
**Adds**: LeadActivity `REOPENED` + optional note. Optionally updates phone and assigns telecaller.

---

## 6) FINAL STATES

- **Final exhaust (closed)**: Stays in senior Exhaust bucket / history.
- **Reopened**: Removed from Exhaust; re-enters telecaller system as Fresh; normal No Answer / callback / overdue rules apply.

---

## DB / Schema

- **Lead**: `isExhausted`, `exhaustedAt`, `exhaustReason` (enum below).
- **Migration**: `prisma/migrations/20250211_add_lead_exhaust_reason/migration.sql` adds `exhaustReason`.

### Recommended `exhaustReason` values (final statuses)

- **WRONG_NUMBER** — Telecaller applied Wrong Number; senior Exhaust bucket.
- **POOL_EXHAUSTED** — No telecaller left in pool; set in `markLeadExhausted()` (shuffleEscalationService).
- (Optional) **DUPLICATE_LEAD**, **FAKE_INQUIRY**, etc. for future exhaust reasons.

Frontend can show different badge/label in Exhaust bucket using `exhaustReason`.
