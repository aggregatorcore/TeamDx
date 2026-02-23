# No Answer / Overdue Implementation Checklist

This checklist tracks the implementation tasks from the SECTION,TASK_TITLE requirements. Model B: 24h = senior alert + flag (lead stays with telecaller), 48h = auto reassign to TL/BM. No manual escalate on card.

---

## OVERDUE_MODEL

| Task | Status | Notes |
|------|--------|--------|
| Lock Final Overdue Model (Model B) | ✅ | Overdue → Red. 24h → senior alert + OVERDUE_ESCALATION_REQUIRED (lead stays). 48h → AUTO_ESCALATED_OVERDUE_48H reassign. Manual escalate button removed. |

---

## NO_ANSWER_ATTEMPTS

| Task | Status | Notes |
|------|--------|--------|
| Enforce exact attempt timings | ✅ | 1/3=+60m, 2/3=next_day_shift_start, 3/3=+48h. Backend overrides wrong workflow config in noAnswerCallbackService and tagApplications. |

---

## NO_ANSWER_3OF3

| Task | Status | Notes |
|------|--------|--------|
| Post max attempt: no 4/3, trigger shuffle | ✅ | In tagApplications apply: when attemptCount >= maxAttempts we return early with shuffle or 409; no 4th TagApplication created. |

---

## SHUFFLE_ENGINE

| Task | Status | Notes |
|------|--------|--------|
| Dynamic telecaller pool, exclude tried owners | ✅ | selectNextOwner uses shuffleTriedOwnerIds; pool from team/company by config. |
| Deactivate old tags on shuffle | ✅ | executeShuffle: all active no_answer set isActive=false; Lead.callbackScheduledAt and callStatus cleared; LeadCurrentTagState deleted. |

---

## EXHAUST_FLOW / EXHAUST_BUCKET

| Task | Status | Notes |
|------|--------|--------|
| Pool exhaust → markLeadExhausted, LeadActivity EXHAUSTED | ✅ | shuffleEscalationService.markLeadExhausted. |
| Exhaust bucket senior-only visibility | ✅ | GET /api/leads filters out isExhausted leads for TELECALLER; Exhaust tab only for TL/BM/Admin. |

---

## SLOT_SCHEDULER

| Task | Status | Notes |
|------|--------|--------|
| No same-time duplicate callback (allocateNextFreeSlot) | ✅ | callbackSlotScheduler allocates 2-min slots per appliedById; shift bounds respected. |
| Optional DB unique index | ✅ Recommended | Migration in `prisma/migrations/add_unique_applied_callback_at_for_active/`. Run so same telecaller + same minute callback never saves twice. |

**DB unique index (recommended):**
Run the existing migration so the slot scheduler is bulletproof:
- `prisma/migrations/add_unique_applied_callback_at_for_active/migration_postgres.sql`
- Table: `tag_applications`; index: `(appliedById, callbackAt) WHERE isActive = true`
Fix any existing duplicates before applying:
1. Find: `prisma/scripts/find-duplicate-active-callbacks.sql` (run in Postgres; export duplicate list for Pooja).
2. Fix: `server/src/jobs/fixDuplicateCallbacks.ts` — Strategy A (nudge) or B (deactivate). Run: `FIX_DUPLICATE_STRATEGY=nudge npx ts-node server/src/jobs/fixDuplicateCallbacks.ts` (from server or project root). Re-run find query → 0 duplicate groups.

---

## POPUP_ENGINE

| Task | Status | Notes |
|------|--------|--------|
| Single popup queue, Skip → 800ms then next | ✅ | activePopupLead = popupDueLeads[0]; delay 800ms on Skip. |
| Focus mode: open from popup → suppress others, "X callbacks waiting" bar | ✅ | focusLeadId set on Open; slim bar shows when focusLeadId && popupDueLeads.length > 0. |

---

## REMINDER_POLICY

| Task | Status | Notes |
|------|--------|--------|
| Split arrays: preCallRemindBeforeMinutes, overdueRemindAfterMinutes | ✅ | Leads page uses preCallRemindBeforeMinutes and overdueRemindAfterMinutes; fallback to remindAtMinutes. Defaults: e.g. [60,15] before, [15,60] after. |

---

## AUTO_FIX

| Task | Status | Notes |
|------|--------|--------|
| ensureNoAnswerCallbackScheduled on GET leads, GET :id, GET :id/tags | ✅ | Implemented in leads.ts. |
| Wrong 1/3 fix (callbackAt − createdAt > 2h → correct to +60m) | ✅ | Step 0 and auto-fix block in noAnswerCallbackService. |

---

## ESCALATION_NOTIFICATION

| Task | Status | Notes |
|------|--------|--------|
| 24h senior alert, LeadActivity OVERDUE_SENIOR_NOTIFIED | ✅ | seniorOverdueNotificationService (only overdue >= 24h); creates OVERDUE_ESCALATION_REQUIRED for flag. |
| 48h auto reassign, LeadActivity AUTO_ESCALATED_OVERDUE_48H | ✅ | autoEscalationService runAutoEscalationOverdue48h; cron runs hourly. |

---

## BUCKET_LOGIC / ATTEMPT_COUNTER / RBAC

| Task | Status | Notes |
|------|--------|--------|
| Single source getLeadBucket() | ✅ | Leads page filter and pill use getLeadBucket(lead) only. |
| Post-shuffle: attempt count only tagHistory after lastHandoffAt | ✅ | Leads page and [id] pass tagHistory filtered by lastHandoffAt/assignedAt. |
| Telecaller: no Exhaust bucket, no manual escalate | ✅ | Exhaust hidden in GET /api/leads for TELECALLER. POST /api/leads/:id/escalate restricted to ADMIN, BRANCH_MANAGER, TEAM_LEADER. |

---

## ACTIVITY_LOGGING

| Task | Status | Notes |
|------|--------|--------|
| Log NO_ANSWER_APPLIED, CALLBACK_SCHEDULED, SHUFFLED, AUTO_ESCALATED_48H, EXHAUSTED | ✅ | tagApplications: NO_ANSWER_APPLIED (+ CALLBACK_SCHEDULED when callbackAt set). shuffleEscalationService: SHUFFLED, EXHAUSTED. autoEscalationService: AUTO_ESCALATED_48H. 24h: OVERDUE_SENIOR_NOTIFIED, OVERDUE_ESCALATION_REQUIRED. |

---

## CLEANUP / DOCUMENTATION

| Task | Status | Notes |
|------|--------|--------|
| Remove manual Escalate button | ✅ | Removed from LeadCardTagInfo, leads page, [id] page, CallbackPopupNotification, OverdueReminderNotification; EscalationNotification section removed. |
| Final workflow document | ✅ | docs/NO_ANSWER_WORKFLOW_SPEC.md updated for Model B and full lifecycle. |

---

## TESTING (minimum prod gate)

Run these before production:

1. **1/3 timing**: Apply No Answer → callback ~60m (or next shift); no 58h.
2. **2/3 timing**: Second No Answer → next day shift start.
3. **3/3 timing**: Third No Answer → +48h.
4. **Shuffle**: 4th No Answer by same owner → lead transferred to another telecaller; no 4/3 tag.
5. **Exhaust**: When no eligible telecaller → 409, LeadActivity EXHAUSTED; lead hidden from telecaller list.
6. **Popup queue**: One popup at a time; Skip → next after 800ms; Open → focus mode + "X callbacks waiting" bar.
7. **Slot stagger**: Multiple callbacks same telecaller → different minutes (e.g. 09:30, 09:32).
8. **24h alert**: Overdue >= 24h → OVERDUE_SENIOR_NOTIFIED + OVERDUE_ESCALATION_REQUIRED; lead stays with telecaller.
9. **48h reassign**: Overdue >= 48h → lead reassigned to TL/BM, AUTO_ESCALATED_OVERDUE_48H.
10. **Exhaust visibility**: Telecaller does not see exhaust bucket; TL/BM/Admin see it.
