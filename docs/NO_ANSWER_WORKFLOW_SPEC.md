# No Answer Workflow – Specification & Status

This document answers the questionnaire for the No Answer callback workflow, leads page, overdue, escalation, shuffle, exhaust, notifications, and edge cases. All answers are derived from the current codebase.

---

## PART 1 – WORKFLOW

### Tag Definition

| Field | Value / Behavior |
|-------|------------------|
| **tagKey** | Not explicitly stored as "tagKey" in DB; workflow nodes use `data.tagValue` or `label` / `name`. |
| **tagValue** | `no_answer` (primary). Matching also by name `"No Answer"` (case-insensitive) and by workflow node id when tagFlowId is the node id. |
| **System / Manual** | Applied manually by user (telecaller) from workflow/call outcome. Callback scheduling and retry timings are system-driven via tagConfig. |
| **Deletable (Yes/No)** | Not explicitly "deletable" in code; tags are deactivated (`isActive: false`) on shuffle. No hard delete of TagApplication. |
| **Editable fields** | TagApplication: `note`, `callbackAt`, `followUpAt`, `isActive`. TagFlow (admin): name, tagValue, color, tagConfig, etc. |
| **Allowed roles** | Apply tag: same as lead assignment (Telecaller, Team Leader, etc.). Schedule callback: `ADMIN`, `BRANCH_MANAGER`, `TEAM_LEADER`, `COUNSELOR`, `TELECALLER`. Telecaller-only for daily use; not strictly "Telecaller only". |

---

### Final TagConfig JSON (No Answer – active workflow)

Exact structure used when workflow config is missing (default) or when building from workflow:

```json
{
  "autoAction": "CALLBACK",
  "retryPolicy": {
    "attemptTimings": [
      { "timing": "60m" },
      { "timing": "next_day" },
      { "timing": "48h" }
    ]
  }
}
```

- **autoAction**: `"CALLBACK"` – creates/schedules callback when No Answer is applied.
- **retryPolicy.attemptTimings**: 1st = 60m, 2nd = next_day, 3rd = 48h. Backend forces 1/3 → +60m and 2/3 → next_day if workflow sends something else.
- **overduePolicy.popupAtSeconds**: From workflow/tagConfig; UI default **30** (popup 30s before or when overdue within 30s).
- **overduePolicy.remindAtMinutes**: Pre-call and overdue reminders; UI default **15, 60** (e.g. 15m and 60m overdue).
- **preCallRemindBeforeMinutes / overdueRemindAfterMinutes**: Represented as `remindAtMinutes` (before = negative or separate config in UI). Code uses `overduePolicy.remindAtMinutes` for reminder windows.
- **Reminder policy (split arrays)**: Use `preCallRemindBeforeMinutes` (e.g. [60, 15]) for reminders **before** callback; `overdueRemindAfterMinutes` (e.g. [15, 60]) for **after** callback. Do not mix. Fallback: `remindAtMinutes` for backward compatibility.
- **Model B – Overdue**: Overdue immediately → Red bucket. **24h overdue** → Senior alert (OVERDUE_SENIOR_NOTIFIED) + "Escalation Required" flag (OVERDUE_ESCALATION_REQUIRED); **lead stays with telecaller**. **48h overdue** → Auto reassign to TL/BM (AUTO_ESCALATED_OVERDUE_48H). No manual Escalate button on card.

---

### Attempt Rules

| Attempt | Timing | Behavior |
|---------|--------|----------|
| **Attempt 1** | **+60m** (then snap to shift; slot-stagger) | If workflow has wrong/incomplete config, backend forces +60m. |
| **Attempt 2** | **next_day** (next day shift start; slot-stagger) | Forced to next_day so 2/3 never shows ~59h. |
| **Attempt 3** | **+48h** (then snap to shift; slot-stagger) | Max local attempts; next No Answer by same owner triggers shuffle. |
| **4th click (same owner)** | **Shuffle** | Same telecaller applies No Answer again after 3/3 → `selectNextOwner` → either **executeShuffle** (new owner) or **markLeadExhausted** (409 Pool exhausted). |

Attempt count is **per owner**: only **active** no_answer TagApplications (and node-id fallback) are counted for scheduling; after shuffle, new owner has 0 then 1/3, 2/3, 3/3.

---

### Execution Flow

1. **TagApplication creation**  
   User applies No Answer → `POST /api/tag-applications/apply` → new TagApplication (entityType=lead, entityId=leadId, tagFlowId, appliedById, callbackAt=null initially).

2. **callbackAt calculation**  
   - Resolve tagConfig from active workflow (tags / tagGroups / nodes).  
   - Count **active** no_answer applications (including by workflow node id) → attemptIndex (0-based).  
   - Get attempt timing: `attemptTimings[attemptIndex]` (default 60m, next_day, 48h). Force 1/3→60m, 2/3→next_day.  
   - Base time = tag `createdAt`.  
   - `calculateShiftAwareCallback(baseTime, timing, shiftStart, shiftEnd)` → raw callback time.  
   - Snap to shift if outside/buffer (e.g. 5 min before shift end → next day shift start).

3. **Shift logic**  
   User/role ShiftConfig (or default telecaller shift). `snapToShift()`: before shift start → today shift start; after shift end or in buffer → next day shift start.

4. **Slot scheduler**  
   `allocateNextFreeSlot(prisma, appliedById, callbackTime, 2, shiftBounds)`: 2-min slots per telecaller; no two active callbacks in same slot for same appliedById; if candidate is beyond shift end, move to next day shift start.

5. **Lead.callbackScheduledAt update**  
   After setting `callbackAt` on TagApplication, all active TagApplications with callbackAt are read; earliest `callbackAt` is written to `Lead.callbackScheduledAt`.

Same flow is used in `ensureNoAnswerCallbackScheduled(leadId)` when an unscheduled or wrong 1/3 callback is found.

---

## PART 2 – LEADS PAGE

### Attempt Counter Logic

- **Display**: "1/3", "2/3", "3/3" in `LeadCardTagInfo`.  
- **Calculation**: Frontend counts tag applications in **tagHistory** that match No Answer (tagValue / tagKey / name).  
- **Source**: `tagHistory` = API-provided tag applications. On list: from GET /api/leads (tagApplications on each lead); on detail: from GET /api/leads/:id/tags.  
- **Post-shuffle**: For new owner, tagHistory is filtered to tags created **after** `lastHandoffAt` (or `assignedAt` when shuffleIndex > 0) so only the new owner’s applications are counted → 0/3 then 1/3, 2/3, 3/3.  
- **Backend** (scheduling): Uses only **active** no_answer applications (and node id match) to compute attempt index; after shuffle all previous no_answer are inactive, so new owner’s first apply = attempt 1.  
- **Table**: TagApplication (entityType=lead, entityId=leadId, tagFlowId / tagValue no_answer, isActive). Count is **active** on backend; frontend uses filtered history for display.

---

### Countdown Logic

- **Util**: `getCountdownText(callbackAt, { includeSeconds: true })` from `@/lib/utils/countdown`.  
- **When shown**: When lead has `currentTag.callbackAt` (or tagApplications[0].callbackAt) and attemptCount < 3 or at 3/3 with callback; updates every 1s.  
- **Overdue**: When `callbackAt` is in the past, text is "Overdue by Xh Ym Zs". Overdue age: `getOverdueAge(callbackAt)` (hours).  
- **If callbackAt null**: Countdown is empty; "Schedule callback" or auto-schedule runs. No crash; UI shows schedule CTA or "Callback not scheduled" until `ensureNoAnswerCallbackScheduled` or user schedule fixes it.

---

### Bucket Movement

- **Fresh →**  
  - With callback scheduled in future → **Orange** (callback bucket).  
  - With callback in past → **Red** (overdue).  
  - If status = lost → **Red**.  

- **Future callback (Orange) →**  
  - When callback time passes → **Red** (overdue).  
  - If lead status = lost → **Red**.  

- **Missed callback (Red) →**  
  - Stays **Red** until callback is made or rescheduled.  
  - 24h overdue → auto-escalation (assignment to TL/BM); bucket still **Red** (callbackAt still in past).  

- **24h overdue →**  
  - Senior alert + "Escalation Required" flag only; 48h cron does reassign.  
  - Exhaust bucket: when `isExhausted === true` and no callbackAt → **exhaust**.  

- **After shuffle →**  
  - New owner: callbackScheduledAt and callStatus cleared; no active tag → **Fresh** (priority 3: "shuffled with old tag" – tag created before lastHandoffAt/assignedAt → Fresh).  
  - Old owner: lead no longer assigned; N/A.  

- **Exhaust →**  
  - When pool exhausted, `markLeadExhausted`: sets **Lead.isExhausted = true**, **Lead.exhaustedAt = now** (state) and creates LeadActivity **EXHAUSTED** (audit). GET /api/leads uses Lead.isExhausted with fallback to activity. Exhausted leads are **hidden from TELECALLER**; visible to TL/BM/Admin.

Exact order in `getLeadBucket`: (1) lost → red; (2) isExhausted && !callbackAt → exhaust; (3) shuffled-with-old-tag → fresh; (4) callbackAt set → future = orange, past = red; (5) no callbackAt and no callStatus → fresh; else callStatus → green/orange/red by TAG_TO_BUCKET_MAP.

---

## PART 3 – OVERDUE

### Overdue Case Attempt 1

- **If Attempt 1 missed (callbackAt in past):**  
  - **Bucket**: **Red** (overdue).  
  - **Notification**: Senior overdue cron can notify TL/BM once per lead per 24h (`lead:overdue_telecaller_missed`); popup can show overdue (30s window or catch-up).  
  - **Senior alert**: Yes – `runSeniorOverdueNotifications()` creates activity `OVERDUE_SENIOR_NOTIFIED` and notifies seniors (TEAM_LEADER, BRANCH_MANAGER, ADMIN).  
  - No automatic reassignment at Attempt 1; 24h auto-escalation is for **any** overdue ≥24h.

---

### 24h Overdue (Model B)

- **Trigger**: Senior overdue cron; selects leads with **active** no_answer and `callbackAt < (now - 24h)`.  
- **Action**: **No reassignment**. Create LeadActivity `OVERDUE_SENIOR_NOTIFIED` (senior notified via socket `lead:overdue_telecaller_missed`). Create LeadActivity `OVERDUE_ESCALATION_REQUIRED` ("Escalation Required" flag).  
- **Telecaller keeps lead?** **Yes** – lead stays with telecaller until 48h.  
- **Cron guard**: Idempotent — if `OVERDUE_ESCALATION_REQUIRED` already in last 24h, or lead already has `AUTO_ESCALATED_48H`, skip (no duplicate 24h alert).

### 48h Overdue (Model B)

- **Trigger**: Auto-escalation cron; selects leads with **active** no_answer and `callbackAt < (now - 48h)`.  
- **Action**: Lead **reassigned** to TL/BM. LeadActivity: `AUTO_ESCALATED_48H`. Then LeadActivity: `OVERDUE_ESCALATION_CLEARED` (24h flag cleared; lead now in senior queue). Socket: `lead:escalated` to manager.  
- **Telecaller keeps lead?** **No** – `assignedToId` is changed to manager.  
- **Cron guard**: Idempotent — if `AUTO_ESCALATED_48H` already exists for lead, skip (no double reassign).

---

## PART 3 – ESCALATION (continued)

### Escalation Trigger: 24h / 48h vs 3/3 + Next Click (Model B)

| | 24h overdue | 48h overdue | 3/3 + next click |
|---|-------------|-------------|-------------------|
| **Trigger** | Cron: active no_answer + callbackAt &lt; now − 24h | Cron: active no_answer + callbackAt &lt; now − 48h | User applies No Answer again after 3 applications (attemptCount ≥ maxAttempts). |
| **Action** | Senior alert + "Escalation Required" flag; **lead stays with telecaller**. | Reassign lead to TL/BM (AUTO_ESCALATED_OVERDUE_48H). | **Shuffle** or **exhaust** (no 4/3 tag created). |
| **Shuffle** | No. | No (reassign only). | Yes – shuffle or exhaust. |

Manual escalate: **Removed** from UI. Only TL/BM/Admin can call POST /api/leads/:id/escalate (e.g. ad-hoc reassignment).

---

## PART 4 – SHUFFLE

### Shuffle Trigger Condition

- **Exact condition**: Current owner applies No Answer and **existing** no_answer applications by **this owner** (same appliedById) count ≥ **maxAttempts** (default 3). So: 4th No Answer application by same user on same lead.  
- **Auto or manual**: **Manual** in the sense that the user clicks to apply No Answer; the shuffle itself is **automatic** once the condition is met (no separate "Shuffle" button; apply-tag handler runs shuffle when attemptCount >= maxAttempts).

---

### Shuffle Mechanics

- **Reassign**: `executeShuffle`: lead `assignedToId` = newOwnerId; `assignedAt`, `previousAssignedToId`, `movedAt` set; `shuffleTriedOwnerIds` updated (current + new owner).  
- **Old telecaller**: Removed as owner (`assignedToId` changes).  
- **Old tags**: All **active** no_answer TagApplications for the lead are set **isActive = false**. So old tags are not active; new owner sees no active tag until they apply No Answer.  
- **Attempt reset**: New owner has 0/3 (no new TagApplication on shuffle). First No Answer by new owner = Attempt 1, +60m, slot-stagger.  
- **Lead state**: `callbackScheduledAt`, `callStatus` set to null; `LeadCurrentTagState` deleted so card is clean for new owner.

---

### Exhaust Flow

- **When**: `selectNextOwner` returns null (no eligible telecaller in pool, or shuffleIndex ≥ shuffleMaxOwnersCap).  
- **What happens**: `markLeadExhausted(leadId, createdById)`: creates LeadActivity type **EXHAUSTED**, title "No Answer pool exhausted". No change to Lead.assignedToId; **isExhausted** is derived from presence of this activity (GET /api/leads builds exhaustedMap from activity).  
- **Bucket**: **exhaust** when isExhausted && !callbackAt (getLeadBucket).  
- **Visible to whom**: **Hidden from TELECALLER** in GET /api/leads. **Visible to TL, BM, Admin** (exhaust bucket).  
- **Response**: 409 "Pool exhausted" with exhausted: true; socket `lead:exhausted` to seniors.

---

## PART 5 – NOTIFICATIONS

### Popup Behavior

- **−30s popup**: Popup shows when callback is within **30 seconds** (config: `overduePolicy.popupAtSeconds` or 30). Condition: `secondsUntilCallback <= popupAtSeconds` or overdue and within 30s.  
- **Pre-call reminders**: Implemented via `CallbackReminderNotification`: reminder when within `reminderMinutes` before callback (e.g. 15m, 60m from tagConfig.overduePolicy.remindAtMinutes).  
- **Overdue reminders**: `OverdueReminderNotification`: windows at reminderMinutes overdue (e.g. 15m, 60m); can show "First Reminder (15m)", "Second Reminder (60m)", "ESCALATION (24h)" in UI.  
- **Focus mode**: When user is on lead detail page (`focusLeadId`), popup is **not** shown (single active popup lead = null when focusLeadId set).  
- **Multi-popup queue**: One popup at a time. `popupDueLeads` = leads in 30s window (overdue first, then soonest); `activePopupLead = popupDueLeads[0]`. Skip/dismiss shows next after delay (e.g. 800ms). TELECALLER: popups only when `telecallerWithinShift === true`.

---

## PART 6 – EDGE CASES

### Shift Handling

- **If shift ended**: `calculateShiftAwareCallback` + `snapToShift`: if computed time is after shift end (or in 5-min buffer), result is **next day shift start**. So callbackAt is never outside shift.  
- **If shift changed mid-day**: Existing callbacks (TagApplication.callbackAt, Lead.callbackScheduledAt) are **not** recalculated. Only new scheduling (new apply or ensureNoAnswerCallbackScheduled) uses current shift config. So existing callbacks can be outside new shift until next reschedule or auto-fix.

---

### Auto Fix Logic (callbackAt null / wrong 1/3)

- **When**: (1) Lead has active no_answer with **callbackAt = null**; or (2) single active no_answer with callback set but **(callbackAt − createdAt) > 2h** (wrong 1/3 e.g. 58h).  
- **Does ensureNoAnswerCallbackScheduled run?** **Yes.**  
- **Where**:  
  - **GET /api/leads** (list): For each lead with no_answer and no callback, or with callback >2h from created, calls `ensureNoAnswerCallbackScheduled(lead.id)` and uses returned callback in response.  
  - **GET /api/leads/:id** (detail): Calls `ensureNoAnswerCallbackScheduled(id)` before returning lead.  
  - **GET /api/leads/:id/tags** (when !includeInactive): Calls `ensureNoAnswerCallbackScheduled(id)` before returning tags.  
  - **POST /api/leads/:id/schedule-callback**: Calls `ensureNoAnswerCallbackScheduled(leadId)` and returns the set callback or 200 with existing callback when found by node id.

---

## PART 7 – FEATURE STATUS

| Feature | Status | Notes |
|--------|--------|--------|
| **Attempt counter** | ✅ Working | Backend: active no_answer count. Frontend: tagHistory filtered by no_answer and post-handoff; 1/3, 2/3, 3/3 and "next No Answer will transfer" at 3/3. |
| **Slot scheduler** | ✅ Working | allocateNextFreeSlot per telecaller, 2-min slots, shift bounds; used in tag apply and ensureNoAnswerCallbackScheduled. |
| **Escalation** | ✅ Working | 24h cron: reassign to TL/BM. 3/3+click: shuffle or exhaust. Manual POST /api/leads/:id/escalate exists. |
| **Shuffle** | ✅ Working | On 4th No Answer (same owner); executeShuffle deactivates no_answer, new owner, clear callback/callStatus/LeadCurrentTagState. |
| **Exhaust bucket** | ✅ Working | markLeadExhausted (activity); isExhausted from activity; GET /api/leads filters out exhausted for TELECALLER; bucket = exhaust when isExhausted && !callbackAt. |
| **RBAC** | ✅ Working | Schedule callback: ADMIN, BRANCH_MANAGER, TEAM_LEADER, COUNSELOR, TELECALLER. Exhausted leads hidden for TELECALLER only. |
| **Popup queue** | ✅ Working | 30s window; one at a time; overdue first; focus mode suppresses; TELECALLER shift gate. |
| **Bucket sync** | ✅ Working | getLeadBucket used for pill and filters; shuffled-with-old-tag → fresh; orange/red by callbackAt; exhaust by isExhausted. |

---

## FINAL SUMMARY – Risk Analysis

### What is stable

- Attempt timings (1/3 → 60m, 2/3 → next_day, 3/3 → 48h) with backend override.  
- Shuffle and exhaust flow (pool, cap, activity, visibility).  
- Bucket rules and exhaust visibility for TELECALLER.  
- Slot scheduler and shift snapping for new callbacks.  
- Popup and reminder structure (30s, remindAtMinutes, focus mode, queue).  
- Auto-fix runs on list, detail, tags, and schedule-callback.

### What is risky

- **1/3 showing ~58h**: Mitigated by Step 0 clear (single active, callback − created > 2h), 2h threshold, and node-id fallback; if workflow still has a single 48h timing and edge cases remain, wrong callback could reappear until next ensureNoAnswerCallbackScheduled run.  
- **Shift change mid-day**: Existing callbacks are not moved; users may see callbacks outside new shift until next apply or auto-fix.  
- **Exhaust detection**: Based on LeadActivity; if activity is deleted or not created in some path, isExhausted could be wrong.

### What must fix before production

- **Verify 1/3 in production**: Ensure server restarted and list/detail/tags all trigger ensureNoAnswerCallbackScheduled; optional: short debug logs in ensureNoAnswerCallbackScheduled (Step 0 clear, tag found, attempt index, timing used).  
- **Confirm tagConfig in workflow**: Ensure active workflow has correct retryPolicy.attemptTimings for no_answer (60m, next_day, 48h) so defaults are not needed in edge cases.  
- **Exhaust visibility**: Confirm TL/BM/Admin see exhaust bucket and can reassign/close; no telecaller sees exhausted leads.

### Logical conflicts

- None critical. 24h escalation (reassign to manager) and 3/3+click (shuffle or exhaust) are separate flows; a lead can be escalated at 24h and later (if reassigned back to a telecaller) still go through shuffle/exhaust.  
- Frontend attempt count uses filtered tagHistory (post handoff); backend uses active count. Both align for "new owner 1/3" because after shuffle there are no active no_answer and new apply creates one.

---

*Document generated from codebase: noAnswerCallbackService, shuffleEscalationService, autoEscalationService, seniorOverdueNotificationService, leads routes, tagApplications, buckets, countdown, LeadCardTagInfo, callbackSlotScheduler, shiftUtils.*
