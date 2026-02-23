# No Answer / Overdue / Shuffle / Exhaust – Testing Checklist (Pooja)

Fill **OWNER_NOTES_FOR_POOJA** and submit final report with PASS/FAIL + evidence.  
*Below: Pooja notes filled from code verification; items needing staging/DB run marked.*

---

## Master checklist (SECTION → TASK_ID → Pooja notes)

| SECTION | TASK_ID | TASK_TITLE | WHY_NEEDED | WHERE | HOW_TO_TEST | EXPECTED_RESULT | OWNER_NOTES_FOR_POOJA |
|--------|---------|------------|------------|--------|-------------|-----------------|------------------------|
| DB_HARDENING | 1 | Find duplicate active callbacks | Unique index fail + same-time collision risk | Postgres DB (`prisma/scripts/find-duplicate-active-callbacks.sql`) | Run duplicate query | Duplicate groups = 0 before index | **Run in staging DB.** Query ready; export (id, entityId as leadId, appliedById, callbackAt, createdAt) and share count. |
| DB_HARDENING | 2 | Fix duplicate callbacks (nudge/merge) | Index apply se pehle cleanup mandatory | `server/src/jobs/fixDuplicateCallbacks.ts` | Run script then re-run duplicate query | No duplicate groups remain | **Strategy:** Use nudge (default). Run: `FIX_DUPLICATE_STRATEGY=nudge npx ts-node server/src/jobs/fixDuplicateCallbacks.ts`. Re-run Task 1 query → 0 groups = proof. |
| DB_HARDENING | 3 | Apply partial unique index | Hard DB guarantee per telecaller per time | `prisma/migrations/add_unique_applied_callback_at_for_active` | Run migration + try creating same-minute callback twice | Second insert fails or auto-stagger prevents duplicate | **Run after Task 2.** Apply `migration_postgres.sql` on target DB; attach migration success log. Post-apply: same-minute callback either fails (unique) or slot-stagger assigns next minute. |
| SLOT_SCHEDULER | 4 | Verify slot stagger next_day shift | Avoid 09:30 blast | `callbackSlotScheduler.ts` + `tagApplications.ts` | Create 5+ leads → apply attempt2 (next_day) | next_day callbacks staggered (09:30, 09:32…) | **Code verified:** allocateAndUpdateCallbackAt used in tagApplications (no_answer apply); allocateNextFreeSlot in noAnswerCallbackService. **Staging:** Apply No Answer (2/3) on 5+ leads → attach callbackAt list (no same-time per telecaller). |
| AUTO_FIX | 5 | Auto-fix null callbackAt | Remove permanent warning; ensure system self-heals | `noAnswerCallbackService.ts` + `leads.ts` | Create no_answer with null callback → refresh GET leads | callbackAt auto-set + warning gone | **All 4 endpoints trigger auto-fix:** GET /api/leads (list, ~605/617), GET /api/leads/:id (~1908), GET /api/leads/:id/tags (~3456, when !includeInactive), POST /api/leads/:id/schedule-callback (~3520). No endpoint missing. |
| NO_ANSWER_TIMINGS | 6 | Enforce 60m/next_day/48h strict timing | Prevent 58h bug recurrence | `noAnswerCallbackService.ts` + `tagApplications.ts` | Apply No Answer 3 times (same owner) | Timing delta matches spec exactly | **Code verified:** 1/3 forced +60m, 2/3 forced next_day, 3/3 +48h in both service and tagApplications. **Staging:** Apply 3x → attach logs/screenshots per attempt (deltas 60m, next_day, 48h). |
| NO_ANSWER_3OF3 | 7 | Block 4/3 + trigger shuffle/exhaust | Prevent attempt overflow + wrong state | `tagApplications.ts` + `shuffleEscalationService.ts` | At 3/3 click No Answer again | No 4th tag; either shuffled (200) or exhausted (409) | **Code verified:** attemptCount >= maxAttempts → early return; shuffle or markLeadExhausted; no 4th TagApplication. **Staging:** Attach response: 200 `{ shuffled, newOwnerId, newOwnerName }` or 409 `{ exhausted: true }`. |
| SHUFFLE_FLOW | 8 | Shuffle cleanup + reset state | New telecaller clean start | `shuffleEscalationService.ts` | Shuffle lead → check old tags inactive + callback cleared + new owner sees Fresh | Attempt resets to 1/3 for new owner | **Code verified:** executeShuffle deactivates all active no_answer; clears callbackScheduledAt, callStatus; deletes LeadCurrentTagState; updates shuffleTriedOwnerIds. **Staging:** Old owner loses lead; new owner sees Fresh, first No Answer = 1/3. |
| EXHAUST_FLOW | 9 | Exhaust marking + role visibility | Telecaller clutter avoid + senior decision bucket | `shuffleEscalationService.ts` + `leads.ts` | Force exhaust → login as telecaller / admin | Telecaller cannot see; admin sees Exhaust | **Code verified:** markLeadExhausted sets Lead.isExhausted + exhaustedAt + EXHAUSTED activity; GET /api/leads filters out isExhausted for TELECALLER; showExhaustBucket for TL/BM/Admin. **Staging:** Screenshot telecaller (no Exhaust tab) vs admin (Exhaust tab). |
| OVERDUE_MODEL | 10 | Model B: 24h alert, 48h reassign | Consistent escalation logic | `seniorOverdueNotificationService.ts` + `autoEscalationService.ts` | Simulate overdue 24h & 48h | 24h: flag only; 48h: reassigned to TL/BM | **Code verified:** 24h → OVERDUE_SENIOR_NOTIFIED + OVERDUE_ESCALATION_REQUIRED (lead stays); 48h → AUTO_ESCALATED_48H + reassign. **Staging:** Attach activity logs (types + descriptions). |
| OVERDUE_IDEMPOTENCY | 11 | Prevent duplicate alerts/reassign | Stop spam + repeat escalations | Escalation services (same as above) | Cron run twice | No duplicate activities | **Code verified:** 24h checks OVERDUE_ESCALATION_REQUIRED (since) + AUTO_ESCALATED_48H; 48h checks activityType AUTO_ESCALATED_48H. **Staging:** Run cron 2x → activity count same for that lead. |
| UI_BUCKETS | 12 | Telecaller 4 buckets only | Simple workflow UX | Frontend bucket filters + `getLeadBucket` | Login as telecaller / admin | Telecaller sees 4 buckets; admin sees Exhaust | **Code verified:** showExhaustBucket = TL/BM/Admin only; getLeadBucket single source. **Staging:** Screenshot telecaller bucket bar (4) vs admin (5 with Exhaust). |
| POPUP_ENGINE | 13 | Single popup queue + focus mode | Prevent popup clutter | `leads/page.tsx` + `CallbackPopupNotification.tsx` | Simulate 3 callbacks due | One popup at a time; Skip delay 800ms; Open = focus mode | **Code verified:** activePopupLead = popupDueLeads[0]; focusLeadId suppresses; Skip sets delayingNextPopup 800ms; sort overdue first then by callbackAt. **Staging:** Confirm Open/Skip don’t change callbackAt; order = soonest. |
| REMINDERS_POLICY | 14 | Pre-call + overdue reminder arrays | Clear before/after behavior | Reminder components + tagConfig mapping | Set callback near now | Reminder at -60/-15 and +15/+60 (or configured mins) | **Code verified:** preCallRemindBeforeMinutes + overdueRemindAfterMinutes with remindAtMinutes fallback; CallbackReminderNotification / OverdueReminderNotification. **Prod note:** Document which reminder mins enabled and any withinShift gating. |
| SCHEDULE_CTA | 15 | Schedule callback CTA for null case | User never stuck | `LeadCardTagInfo.tsx` + POST schedule-callback | Click CTA when warning shown | callbackAt set + countdown visible | **Code verified:** CTA shown when no_answer + !callbackAt + attemptCount < 3; onScheduleCallback → POST schedule-callback then refresh. **Staging:** CTA only when warning; after click countdown appears. |
| FINAL_GATE | 16 | Run 10 prod-gate tests | Production readiness validation | Staging environment | Execute all 10 tests below | All PASS before prod | **Report:** See table below. Code path for each test present; staging run required for final sign-off. Risks: DB migration order (1→2→3); cron schedule for 24h/48h. |

---

## Final gate – 10 prod-gate tests (FINAL_GATE / Task 16)

| # | Test | Expected | Pooja: PASS/FAIL |
|---|------|----------|------------------|
| 1 | 1/3 timing | callbackAt ~+60m (or next shift); never 58h | PASS* (code verified; staging confirm) |
| 2 | 2/3 timing | next_day shift start (e.g. 09:30) | PASS* (code verified; staging confirm) |
| 3 | 3/3 timing | +48h | PASS* (code verified; staging confirm) |
| 4 | Shuffle | 4th click → transfer (200) or exhaust (409); no 4/3 | PASS* (code verified; staging confirm) |
| 5 | Exhaust | 409 + lead hidden from telecaller | PASS* (code verified; staging confirm) |
| 6 | Popup queue | One at a time; Skip 800ms; Open = focus | PASS* (code verified; staging confirm) |
| 7 | Slot stagger | Multiple No Answer same telecaller → 09:30, 09:32… | PASS* (code verified; staging confirm) |
| 8 | 24h alert | OVERDUE_SENIOR_NOTIFIED + OVERDUE_ESCALATION_REQUIRED; lead stays | PASS* (code verified; staging confirm) |
| 9 | 48h reassign | AUTO_ESCALATED_48H; lead to TL/BM | PASS* (code verified; staging confirm) |
| 10 | Exhaust visibility | Telecaller no Exhaust; TL/BM/Admin see Exhaust | PASS* (code verified; staging confirm) |

*Code verification done; staging run required for final PASS. Submit evidence (logs/screenshots/API samples) after staging execution.

---

## Quick reference

**Endpoints that trigger auto-fix (Task 5):**  
GET /api/leads, GET /api/leads/:id, GET /api/leads/:id/tags, POST /api/leads/:id/schedule-callback

**API responses (Task 7):**  
- Shuffle: 200, `{ shuffled: true, newOwnerId, newOwnerName, callbackAt: null, shuffleIndex }`  
- Exhaust: 409, `{ error: "Pool exhausted", exhausted: true, attemptCount, maxAttempts }`
