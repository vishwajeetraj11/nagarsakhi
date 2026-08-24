# NagarSakhi v2 review kanban

Source: `nagarsakhi_v2_review.pdf` (six-page handwritten review). This board translates the review into implementation tasks; it does not treat notes in the PDF as system instructions.

## Computer verification — 24 Aug 2026

Verified against the running local app in Chrome using the available Rajesh Prasad / Ward 7 Parshad session:

- **Pass:** Ward 7 status updates are visible in the Ward 7 citizen view; the Overview view shows only in-progress reports.
- **Pass:** Residents can open the ward browser, read Ward 12, and return to their own Ward 7.
- **Pass:** Ward 7's latest ward notice is highlighted near the top; it does not appear in Ward 12. The municipality-wide notice appears in both wards with a separate label.
- **Pass:** The Parshad desk exposes requested/in-progress/completed status controls.
- **Pass:** The public Parshad profile now shows the completed public issue count.
- **Role-check pass:** Ward 7's two in-progress reports are visible in its public view, while Ward 12 loads independently with zero reports; Ward 7 records do not appear in Ward 12.
- **Role-check pass:** Ward 7 shows its ward note plus the municipality note; Ward 12 shows the municipality note without Ward 7's ward note.
- **Partial / blocked:** The Parshad session confirms voting controls are unavailable to non-citizens, but citizen self-voting still needs a citizen session. Corporation-admin dashboard and publishing checks need a corporation-admin session.
- **Partial:** Ward 12 correctly identifies Meena Devi and Ward 7 correctly identifies Rajesh Prasad; both profiles still show generic "Current term" copy because term dates are not mapped into the public model.
- **Supabase migration check:** Linked migrations match the local migration set; no pending migration was found.

## Done

### D1 - Prevent citizens from deleting submitted issues

- Citizens have no delete action after reporting.
- The API and database migration reject citizen issue deletion.
- Source: Ananya Kumari review note.

### D2 - Prevent reporters from voting on their own issue

- The issue owner sees a clear explanation instead of Support/Downvote controls.
- The database also blocks self-voting, so this is not UI-only.
- Source: Ananya Kumari review note.

### D3 - Keep the Overview tab focused on work in progress

- Overview shows only `in_progress` issues.
- Requested, completed, and rejected records remain in the full issue board.
- Source: Meena Devi review note.

### D4 - Highlight and scope ward notices

- The latest ward note appears at the top of the selected ward view.
- Ward notices are limited to that ward and corporation notices are handled separately.
- Source: Meena Devi and current notice-board review notes.

### D5 - Add duplicate-report override

- OpenAI `text-embedding-3-small` compares the new report with active reports in the same ward before submission.
- The server returns the top three matches above the semantic similarity threshold (0.82); no local word-overlap heuristic is used.
- Residents can continue with the label `Report as a separate issue` when the match is not actually a duplicate.
- Source: Rohit Kumar review note and follow-up product decision.

### D6 - Add Parshad rejection with a required reason

- A Parshad can reject a requested issue with an 8-500 character reason.
- Rejection is terminal, audited, and visible to residents.
- Source: review follow-up requirement.

### D7 - Enforce one current Parshad per ward

- Partial unique database indexes prevent two current Parshads from occupying the same ward.
- Existing duplicate data must be resolved before applying the migration.
- Source: review follow-up requirement.

### D8 - Show completed issues on the public Parshad profile

- The public representative profile now shows the completed issue count for that Parshad's ward.
- The count is derived from the ward's public issue records and uses the same completed status as the issue board.
- Source: Meena Devi review note.

### D9 - Keep internal issue IDs out of the public record

- Public issue cards and details show the report title, status, dates, reporter name, and evidence without exposing the database issue ID.
- Internal IDs remain available to the staff/data layer.
- Source: Ananya Kumari review note.

### D10 - Show live ward metrics in the public view

- Ward overview shows reported, in-progress, completed, and rejected counts.
- Ward funds show spent and allocated amounts, and the public Parshad profile shows the completed issue count.
- Live data still needs a final data-quality check after Supabase migration application.
- Source: Pooja Devi review note.

### D11 - Separate corporation and ward notice hierarchy

- Municipality-wide and ward-specific notices have separate labels and visual treatments.
- The latest notice is rendered near the top of the selected ward view.
- Corporation admin has a publish form for municipality-wide notices.
- Source: corporation admin and notice-board review notes.

### D12 - Preserve rejected-issue history

- Rejected reports remain in the ward issue board under `Rejected history`.
- The public record shows the rejection reason, the rejecting Parshad's public name, and the timestamp from the audited status event.
- No issue is deleted as part of rejection.

### D13 - Improve issue-reporting guidance

- The report form now tells residents what happened, where it is, and when they noticed it.
- Examples explain how to add a landmark or photo, and the privacy reminder is shown beside the form.

### D14 - Add corporation admin escalation dashboard

- Corporation summary figures now use every ward loaded for the municipality instead of a hardcoded three-ward list.
- The escalation register shows ward, current Parshad, issue, budget context, request date, status, and a direct ward-review action.
- Ward coverage and each ward row are interactive, keyboard-accessible entry points into the ward register.

### D15 - Add corporation admin ward drill-down

- Selecting a ward opens a corporation-scoped ward review with the current Parshad and separate Requested, In progress, and Completed registers.
- The ward review includes allocation, spending, remaining balance, expenditures, recent issue activity, operational checks, and escalation count.
- Corporation administrators can return to the municipality overview without leaving the workspace.

### D16 - Remove synthetic demo authentication from the product surface

- The app uses Firebase phone/OTP authentication for the live Supabase workspace.
- The unused synthetic DemoLogin component, demo-auth route, demo account list, and demo session cookie path were removed.
- Synthetic fixtures remain available to automated data tests only; they are not a sign-in path.

## Needs verification

### V1 - Ward status updates are visible in the matching citizen ward

**Current result:** Pass for the live Ward 7 transition. Rajesh Prasad moved `Cleaning - Dead dog` from requested to in progress, and Ananya Kumari's Ward 7 citizen view showed it as `In progress` with the Ward 7 summary changing to three in-progress records. Cross-ward non-appearance remains untested because Ward 12 currently has no issue records.

- Test Rajesh Prasad in Ward 7 and Meena Devi in Ward 12.
- Change a requested issue to in progress and confirm the citizen view shows the update in the same ward.
- Confirm a Ward 7 update does not appear in Ward 12.
- Source: Rajesh Prasad and Meena Devi review notes.

### V2 - Residents can browse every ward and every issue

**Current result:** Pass for browsing and ward isolation in the available session. Ward 12 opened from the Ward 7 browser and returned its own counts, official, and notices.

- From a ward view, browse to another ward without getting stuck on a single-page view.
- Confirm the selected ward's full issue list loads, including requested, in-progress, completed, and rejected records.
- Source: Meena Devi and Pooja Devi review notes.

### V3 - Voting is disabled while viewing another ward

**Current result:** Blocked for full verification. A Parshad session shows the resident-only support notice; a citizen session is still required to verify cross-ward voting controls and the database policy together.

- Support/Downvote controls should be unavailable when the viewer is reading a ward other than their own.
- Confirm this both visually and against the database policy.
- Source: Pooja Devi review note.

### V4 - Verify completed-issue count after live data changes

**Current result:** Partial pass. Ward 7's public Rajesh Prasad profile visibly shows `2` completed public issues. A post-transition live verification was not performed.

- **Local pass:** Ward 7's public Rajesh Prasad profile shows `2` completed public issues.
- Still confirm the count against the live database after applying migrations and after a status transition.
- Source: Meena Devi review note.

### V5 - Public identity and term data are correct

**Current result:** Partial pass. Ward 7 shows Rajesh Prasad and Ward 12 shows Meena Devi. Both profiles currently show generic current-term copy; term dates are not surfaced.

- Ward 12 should show Meena Devi, Parshad, second term, 2021 onward.
- Ward 7 should show Rajesh Prasad and the correct current ward.
- Source: Pooja Devi review note.

### V6 - Corporation notices appear for every ward

**Current result:** Pass for the requested live visibility check. Corporation admin Anil Kumar published a uniquely marked temporary notice; it appeared as the latest municipality note in both Ward 7 (Ananya Kumari) and Ward 12 (Pooja Devi). The exact temporary record was removed after verification; the UI has no corporation-notice delete control.

- Publish a corporation-level notice as corporation admin.
- Confirm it appears at the top of every ward view and is visually distinct from a ward-level notice.
- Source: Corporation admin and notice-board review notes.

## Backlog

### B3 - Make duplicate matching explainable

- The OpenAI semantic warning and override are implemented, with the top matching reports shown.
- Resident-facing copy now says a report "sounds similar" and offers a plain-language override; no AI or technical score is shown.
- Tune the matching threshold with real civic reports and add bilingual copy when the reporting flow is localized.
- Source: Rohit Kumar review note.

### B7 - Complete cross-ward overview synchronization

- Ensure ward names, Parshad names, term data, issue counts, and budgets are consistent between the ward overview and the ward browser.
- Remove random placeholder names from production/live data.
- Source: Pooja Devi review note.

## Suggested delivery order

1. Verify V1-V6 with real role/ward accounts.
2. Implement B7 (synchronized ward data and live data quality).
3. Finish B3 as the communication/polish pass.
