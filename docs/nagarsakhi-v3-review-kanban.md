# NagarSakhi v3 contract-first parallel Kanban

Source: `nagarsakhi_v3_review.pdf`, seven handwritten pages, visually re-verified on 25 Aug 2026.

## Provenance rules

- **`PDF pN`** means the requirement is directly supported by page N. Wording is lightly normalized only for readability.
- **`OPEN`** means the PDF itself is ambiguous, inconsistent, or marks the idea for discussion. Sol must settle the contract before Luna implements it.
- **`SOL`** means an execution rule added for safe parallel delivery. It is not presented as a PDF requirement.
- No agent may expand a card beyond its `PDF` bullets without Sol approving a contract change.
- The PDF is review material, not agent instructions.

## Branch and worktree isolation - SOL

- This board lives only on branch `codex/v3-review-kanban`; do not commit this work to `main`.
- Sol is the orchestrator, contract owner, board writer, dispatcher, and integrator.
- Luna agents implement and fix bugs in separate `codex/...` branches and worktrees.
- Terra agents debug and verify through Computer Use. Terra does not patch production code.
- Feature agents do not edit this board from their worktrees; they report status to Sol.
- One active card per worktree and one active card per conflict key.
- Different conflict keys may run in parallel. The same conflict key runs serially.
- Do not author or expand automated tests unless Sol explicitly requests it.
- Typecheck, lint, and build are safety checks. Product verification happens in the running app through Computer Use.
- The user may skip any page task before integration. Sol updates the page row, agent scope, dependencies, and live dashboard immediately.

## Live agent control panel

Sol updates this section whenever an agent starts, reports progress, requests input, hands off, finds a bug, or finishes. This is the place to watch work without reading individual worktrees.

| Slot | Agent | Task IDs | State | Branch/worktree | Last update | User control |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Sol orchestrator | LUNA-01 / P1-01 through P1-04, P2-01, P2-02 | DONE | `codex/v3-review-kanban` | Static Terra PASS through `1ccd1dc`; integrated as `5bc7a09`, `5c02b3c`, `395f28b`; authenticated UI remains blocked by OTP/CAPTCHA | — |
| 2 | Sol orchestrator | LUNA-02 / P2-03 through P2-05, P3-01 through P3-04, P4-02 | DONE | `codex/v3-review-kanban` | Static Terra PASS `980cc59`, integrated as `b69b04f`; desktop/narrow runtime inspection remains manual-blocked | — |
| 3 | Sol orchestrator | LUNA-04 / P5-01 through P5-07, P6-01 through P6-03 | DONE | `codex/v3-review-kanban` | Static Terra PASS `a841cee`, integrated as `55b971b`; Corporation-role runtime inspection remains manual-blocked | — |
| 4 | Sol orchestrator | LUNA-06 / verified Parshad phone numbers | NEEDS INPUT | Not dispatched | Official government sources expose results and the municipal office number, but no public contact list for all 28 Parshads | Provide official contact sheet or authorize municipal-office verification |

### Live-state vocabulary

- `AWAITING GO-AHEAD` - present in the PDF board but not approved.
- `APPROVED` - approved by the user and waiting for dispatch/dependencies.
- `IN PROGRESS` - Luna is implementing it.
- `NEEDS INPUT` - an agent is paused on a contract question.
- `TERRA REVIEW` - implementation is being verified through Computer Use.
- `TERRA REVIEW QUEUED` - Luna has committed the card and it is waiting for a Terra verification slot.
- `MANUAL VERIFICATION BLOCKED` - static review found no contract bug, but Computer Use could not safely inspect the running branch.
- `FIXING BUG-N` - Luna is fixing a Terra finding.
- `READY TO INTEGRATE` - Terra passed it; Sol has not integrated it yet.
- `DONE` - integrated by Sol.
- `SKIPPED` - explicitly excluded by the user.
- `ON HOLD` - user asked Sol not to decide or dispatch it yet.

### Skip and resume controls

- Say `Skip P3-06` to skip one task, or `Skip page 3` to skip every unfinished task on that page.
- Say `Resume P3-06` to return a skipped task to `AWAITING GO-AHEAD`.
- If the task is active, Sol tells the agent to stop that exact scope and preserve other approved work in the packet.
- If skipping breaks another approved task's dependency, Sol marks the dependent task `NEEDS INPUT` instead of inventing replacement behavior.
- Skipped tasks are never silently reintroduced during bug fixing or integration.

## Contract gate and decision log

### CONTRACT-01 - Canonical municipality name

- **Status:** RESOLVED by user, 25 Aug 2026
- **Source:** OPEN, pages 2-3
- Page 2 says `Phusro Nagar Parishad`.
- Page 3 uses an outdated entity type.
- **Approved contract:** The canonical public name is `Phusro Nagar Parishad`.
- **Blocks:** None

### CONTRACT-02 - Other-ward read-only boundary

- **Status:** RESOLVED by user, 25 Aug 2026
- **Source:** PDF p1
- Exact intent: citizens can view other wards but make no updates.
- **Approved contract:** A citizen viewing another ward cannot report an issue or vote there. No new actions are introduced by this contract.
- **Blocks:** None

### CONTRACT-03 - Placeholder public finance values

- **Status:** RESOLVED by user delegation to Sol, 25 Aug 2026
- **Source:** OPEN, pages 3, 4, and 6
- Page 3 asks for random ward-fund and commitment numbers.
- Page 4 asks for a fixed issue with a random cost `for now`.
- Page 6 asks to replace zero public-spending values with a random number between ₹3-5 crore.
- **Approved persistence contract:** The database is the source of truth. Values must survive refreshes and remain identical across Citizen, Parshad, and Corporation views. No render-time or refresh-time randomness.
- **Approved temporary dataset:** Persist the existing fixed demo ward-budget dataset instead of inventing a new set. Its 28 allocations total ₹4,93,05,000, within the PDF's ₹3-5 crore range.
- **Approved temporary expenditures:** Persist the existing four fixed demo entries: ₹5,40,000 for Ward 7 LED streetlight replacement; ₹8,25,000 and ₹6,62,500 for Ward 12 drain/crossing work; and ₹4,10,000 for Ward 18 community-park repairs.
- **Database rule:** Use idempotent stored records in `ward_budgets` and `expenditures`; repeated application must not duplicate expenditures.
- **Labeling rule:** These remain clearly identified as temporary/demo finance values until replaced by authoritative figures.
- **Blocks:** None

### CONTRACT-04 - Calendar versus Ward Tasks

- **Status:** ON HOLD by user, 25 Aug 2026
- **Source:** OPEN, page 4
- The note says `Ward Tasks ? Discussion?` and suggests it can replace Ward Calendar, possibly with Aadhaar verification or something similar.
- **Decision required later:** Either keep the page 3 calendar change or replace it with a separately defined Ward Tasks contract. Aadhaar verification is not approved by the PDF note alone.
- **Blocks:** The calendar/task portion of LUNA-03

### CONTRACT-05 - Public Parshad phone-number source and placement

- **Status:** NEEDS INPUT after authoritative-source audit, 25 Aug 2026
- **Source:** USER request, 25 Aug 2026; not in the PDF
- Add phone numbers for the Parshad of each ward as the final delivery task.
- **Authoritative-source audit:** The [Bokaro municipal-election page](https://bokaro.nic.in/hi/%E0%A4%A8%E0%A4%97%E0%A4%B0%E0%A4%AA%E0%A4%BE%E0%A4%B2%E0%A4%BF%E0%A4%95%E0%A4%BE-%E0%A4%86%E0%A4%AE-%E0%A4%9A%E0%A5%81%E0%A4%A8%E0%A4%BE%E0%A4%B5-2026/) publishes official ward results but no official contact numbers. The [official Phusro utility page](https://bokaro.nic.in/hi/public-utility/%E0%A4%A8%E0%A4%97%E0%A4%B0-%E0%A4%AA%E0%A4%B0%E0%A4%BF%E0%A4%B7%E0%A4%A6-%E0%A4%AB%E0%A5%81%E0%A4%B8%E0%A4%B0%E0%A5%8B/) publishes only the municipal office number, not 28 Parshad numbers. The [Bokaro telephone directory](https://bokaro.nic.in/hi/%E0%A4%A6%E0%A5%82%E0%A4%B0%E0%A4%AD%E0%A4%BE%E0%A4%B7-%E0%A4%A8%E0%A4%BF%E0%A4%B0%E0%A5%8D%E0%A4%A6%E0%A5%87%E0%A4%B6%E0%A4%BF%E0%A4%95%E0%A4%BE/) contains district officers, not ward Parshads.
- **Input required:** Provide an official municipal contact sheet/directory for all 28 current ward Parshads, or authorize a separate municipal-office verification workflow. Confirm that each number is intended as a public official contact.
- **Proposed placement:** The Parshad's public profile and the matching row on the shared Municipality Page; no number is shown until verified.
- Never invent, infer, or expose an unverified/private number.
- **Blocks:** LUNA-06 only; it does not block PDF tasks.

## PDF page approval board

This is the go-ahead surface. Every row maps one source note to its delivery agent. Sol changes `Awaiting go-ahead` only after the user approves the page or task ID.

The `Go ahead` cell is also the task's live state: `[ ]` means awaiting approval, `[x]` means approved, and Sol replaces it with `IN PROGRESS`, `TERRA REVIEW`, `DONE`, or `SKIPPED` as work moves.

You can approve work by saying, for example:

- `Go ahead with page 1.`
- `Go ahead with P1-01 and P1-04.`
- `Hold P4-04; approve the rest of page 4.`

### PDF page 1 - Citizen flow

| Go ahead | ID | Task from page 1 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [x] | P1-01 | Remove issue reporting from Overview; Issues and Report remain the other two reporting paths. | LUNA-01 | None |
| [x] | P1-02 | Remove the duplicate ward-browsing control (`Wards` versus `Browse wards`). | LUNA-01 | None |
| [x] | P1-03 | Let citizens view other wards but make no updates there. | LUNA-01 | CONTRACT-02 |
| [x] | P1-04 | Give downvoting feedback different from support feedback; preserve `Your support was recorded` for support. | LUNA-01 | None |

**Page status:** APPROVED

### PDF page 2 - Issues and common municipality page

| Go ahead | ID | Task from page 2 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [x] | P2-01 | Allow selection between issue progress statuses on the Issues page. | LUNA-01 | None |
| [x] | P2-02 | Open an issue's report when that issue is selected. | LUNA-01 | None |
| [x] | P2-03 | Add a common read-only municipality page for all roles. | LUNA-02 | CONTRACT-01 |
| [x] | P2-04 | Show municipality details on the common page. | LUNA-02 | CONTRACT-01 |
| [x] | P2-05 | Make NagarSakhi clickable and open the common municipality page. | LUNA-02 | CONTRACT-01 |

**Page status:** APPROVED

### PDF page 3 - Municipality and Parshad

| Go ahead | ID | Task from page 3 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [x] | P3-01 | Add the Phusro municipality home page. | LUNA-02 | CONTRACT-01 |
| [x] | P3-02 | Show names for all ward Parshads. | LUNA-00, LUNA-02 | None |
| [x] | P3-03 | Show approved temporary ward-fund and commitment numbers. | LUNA-00, LUNA-02 | CONTRACT-03 |
| [x] | P3-04 | Show a term number next to the ward representative. | LUNA-00, LUNA-02 | None |
| [x] | P3-05 | Keep Parshad login opening Parshad Desk and showing fixed issues. | LUNA-03 | None |
| [x] | P3-06 | Add filters to the cluttered Issue Register. | LUNA-03 | None |
| [x] | P3-07 | Remove `Required follow-ups` from Ward Calendar. | LUNA-03 | None |
| ON HOLD | P3-08 | Change the order of Ward Calendar and Resident Notice, and add a real date-selectable calendar. | LUNA-03 | CONTRACT-04 |
| [x] | P3-09 | Add `View as Citizen` to the Parshad experience. | LUNA-03 | None |
| [x] | P3-10 | Show the missing municipality-wide notice at the top of the Parshad view. | LUNA-03 | None |

**Page status:** APPROVED EXCEPT P3-08 ON HOLD

### PDF page 4 - Parshad card and public work account

| Go ahead | ID | Task from page 4 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [x] | P4-01 | Use `Ward Parshad`, make the Parshad name the profile link, and show the actual term number; the sketch uses `2nd term`. | LUNA-00, LUNA-03 | None |
| [x] | P4-02 | Show ward funds and commitments in Public Work Account. | LUNA-00, LUNA-03 | CONTRACT-03 |
| [x] | P4-03 | Temporarily show a fixed issue with an approved cost in Recent Spending. | LUNA-00, LUNA-03 | CONTRACT-03 |
| ON HOLD | P4-04 | Decide whether Ward Tasks replaces Ward Calendar; the PDF marks this for discussion and mentions Aadhaar verification only as an uncertain example. | Sol | CONTRACT-04 |

**Page status:** APPROVED EXCEPT P4-04 ON HOLD

### PDF page 5 - Corporation Official

| Go ahead | ID | Task from page 5 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [x] | P5-01 | Keep Corporation Official login opening Corporation Desk; choosing a ward opens its ward view. | LUNA-04 | None |
| [x] | P5-02 | Show ward work by status. | LUNA-04 | None |
| [x] | P5-03 | Synchronize Ward Budget. | LUNA-00, LUNA-04 | CONTRACT-03 |
| [x] | P5-04 | Update Ward Activity with tags/color coding. | LUNA-04 | None |
| [x] | P5-05 | Rename `Corporation Overview` to `Municipal Overview`. | LUNA-04 | CONTRACT-01 |
| [x] | P5-06 | Show Escalated Issues information for Ward, Parshad, Issue, Request, Status, and Ward View. | LUNA-04 | None |
| [x] | P5-07 | Remove the redundant standalone `Ward 7` element shown in the sketch. | LUNA-04 | None |

**Page status:** APPROVED

### PDF page 6 - Corporation dashboard

| Go ahead | ID | Task from page 6 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [x] | P6-01 | Replace the zero Public Spending display with an approved temporary value between ₹3-5 crore. | LUNA-00, LUNA-04 | CONTRACT-03 |
| [x] | P6-02 | Remove Operational Alerts because they have no point right now. | LUNA-04 | None |
| [x] | P6-03 | Let Public Notices take the entire available width. | LUNA-04 | None |

**Page status:** APPROVED

### PDF page 7 - UI/UX and sign-in

| Go ahead | ID | Task from page 7 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| TERRA PASS | P7-01 | Apply the NagarSakhi identity and the source messages: `Your ward, in the open`, `See what's happening in your ward`, and `Make sure your voice counts`. | LUNA-05 | None |
| TERRA PASS | P7-02 | Explain: file issues, vote on priorities, track ward work, and see where the budget goes. | LUNA-05 | None |
| TERRA PASS | P7-03 | Use `Private sign-in. Public accountability.` | LUNA-05 | None |
| TERRA PASS (desktop) | P7-04 | Present secure registered-mobile sign-in with `+91`, CAPTCHA below the input, and `Get OTP`. | LUNA-05 | None |
| TERRA PASS | P7-05 | Add a favicon. | LUNA-05 | None |

**Page status:** IMPLEMENTED AND INTEGRATED; desktop Terra PASS; narrow Computer Use verification still pending

## Ready after contracts - delivery cards

### LUNA-00 - Shared civic and finance contract implementation

- **Status:** DONE; integrated as `c439f61` + `94f2ba5`; Terra PASS
- **Conflict key:** `data-contract`
- **Branch:** `codex/v3-civic-contracts`
- **Worktree:** `../nagarsakhi-wt-v3-civic-contracts`
- **Source:** PDF pages 2-6
- **Scope:** Implement only the approved shared municipality name, ward/Parshad names, term numbers, ward funds, commitments, recent-spending value, and public-spending value needed by downstream cards.
- **Do not add:** New civic fields, new finance behavior, or new identity requirements not approved in the contract gate.
- **Handoff:** Commit, changed files, approved contract mapping, typecheck/lint/build results.

### LUNA-01 - Citizen flow changes

- **Status:** DONE; source commits `be758c0`, `a57ed81`, `1ccd1dc` integrated as `5bc7a09`, `5c02b3c`, `395f28b`
- **Conflict key:** `citizen-ui`
- **Branch:** `codex/v3-citizen-flow`
- **Worktree:** `../nagarsakhi-wt-v3-citizen-flow`
- **Source:** PDF pages 1-2
- **Scope:**
  - Remove issue reporting from Overview.
  - Remove the duplicate ward-browsing control.
  - Apply the approved other-ward read-only contract.
  - Add progress-status selection on the Issues page.
  - Open the issue report when an issue is selected.
  - Give downvote feedback different from support feedback.
  - Preserve `Your support was recorded` for support.
- **Do not add:** Any new citizen action, permission, issue status, or copy not listed above.
- **Computer Use verification:** Citizen role; Overview, Issues, Report, own ward, other ward, support, downvote, issue opening.

### LUNA-02 - Shared municipality home page

- **Status:** DONE; source `980cc59` integrated as `b69b04f`; static Terra PASS, desktop/narrow runtime inspection remains manual-blocked
- **Conflict key:** `municipality-page`
- **Branch:** `codex/v3-municipality-page`
- **Worktree:** `../nagarsakhi-wt-v3-municipality-page`
- **Source:** PDF pages 2-4
- **Scope:**
  - Add the common read-only municipality page for all roles.
  - Show municipality details.
  - Show all ward Parshad names and approved term numbers.
  - Show approved ward funds and commitments.
  - Make NagarSakhi open this page.
- **Do not add:** Unapproved municipality sections, private details, or invented finance values.
- **Computer Use verification:** Open the page from each available role and verify the displayed source fields and NagarSakhi navigation.

### LUNA-03 - Parshad Desk changes

- **Status:** DONE; source `2d32e4c` integrated as `3bcc0b3`; P3-08 and P4-04 are ON HOLD
- **Conflict key:** `official-ui`
- **Branch:** `codex/v3-parshad-desk`
- **Worktree:** `../nagarsakhi-wt-v3-parshad-desk`
- **Source:** PDF pages 3-4
- **Scope:**
  - Keep Parshad login opening Parshad Desk and showing fixed issues.
  - Add filters to the Issue Register.
  - Remove `Required follow-ups`.
  - Apply the approved calendar/task contract and section order.
  - Add `View as Citizen`.
  - Show the municipality-wide notice at the top.
  - Use `Ward Parshad`, make the name the profile link, and show the approved term number.
  - Show ward funds, commitments, and the approved temporary recent-spending item.
- **Do not add:** Aadhaar verification or a Ward Tasks system unless CONTRACT-04 explicitly defines it.
- **Computer Use verification:** Parshad role; login landing, fixed issues, filters, notice placement, citizen view, representative card, and approved calendar/task behavior.

### LUNA-04 - Corporation Desk changes

- **Status:** DONE; source `a841cee` integrated as `55b971b`; static Terra PASS, Corporation-role runtime inspection remains manual-blocked
- **Conflict key:** `official-ui`
- **Branch:** `codex/v3-corporation-desk`
- **Worktree:** `../nagarsakhi-wt-v3-corporation-desk`
- **Source:** PDF pages 5-6
- **Scope:**
  - Keep Corporation Official login opening Corporation Desk.
  - Make ward selection open the ward view.
  - Show ward work by status.
  - Synchronize Ward Budget with the approved shared values.
  - Update Ward Activity with tags/color coding.
  - Rename Corporation Overview to Municipal Overview.
  - Keep the Escalated Issues information listed on page 5 and remove the redundant Ward 7 element.
  - Use the approved temporary ₹3-5 crore Public Spending value.
  - Remove Operational Alerts.
  - Let Public Notices take the available width.
- **Do not add:** New corporation workflows, columns, statuses, or finance behavior not listed above.
- **Computer Use verification:** Corporation Official role; login landing, ward selection, status grouping, budget, activity tags, overview label, escalations, removed alerts, and notices width.

### LUNA-05 - Sign-in and UI/UX update

- **Status:** INTEGRATED as `2ba3f44` + `49dbc9e`; desktop Terra PASS; narrow Computer Use verification pending
- **Conflict key:** `auth-brand`
- **Branch:** `codex/v3-auth-brand`
- **Worktree:** `../nagarsakhi-wt-v3-auth-brand`
- **Source:** PDF page 7
- **Scope:** Apply only the source-verified messages, registered-mobile sign-in treatment, `+91`, CAPTCHA placement, `Get OTP`, NagarSakhi identity treatment, and favicon.
- **Do not add:** New authentication methods, new brand claims, or identity-verification requirements.
- **Computer Use verification:** Signed-out UI at narrow and desktop sizes. CAPTCHA interaction remains a user handoff when required.

### LUNA-06 - Verified Parshad phone numbers for every ward

- **Status:** NEEDS INPUT; all approved PDF tasks are complete, but CONTRACT-05 has no authoritative 28-number source
- **Conflict key:** `parshad-contact`
- **Branch:** `codex/v3-parshad-phone-numbers`
- **Worktree:** `../nagarsakhi-wt-v3-parshad-phone-numbers`
- **Source:** USER request, 25 Aug 2026; not in the PDF
- **Scope:** Add the verified official public phone number for each ward's Parshad in the placement approved by CONTRACT-05.
- **Do not add:** Invented numbers, private numbers, numbers without a ward/Parshad match, or additional contact fields.
- **Computer Use verification:** Inspect every ward and compare the displayed Parshad-number pairing with the approved source.

## Parallel dispatch order - SOL

1. CONTRACT-01 through CONTRACT-03 are resolved. CONTRACT-04 remains ON HOLD; do not dispatch P3-08 or P4-04.
2. Run LUNA-00 and LUNA-05 in parallel because their conflict keys differ.
3. After LUNA-00, run LUNA-01, LUNA-02, and LUNA-03 in parallel because their conflict keys differ.
4. Run LUNA-04 only after LUNA-03 is integrated because both touch `official-ui`.
5. Send every completed Luna branch to a Terra agent for Computer Use verification.
6. Terra reports one bug card per reproducible defect; Luna fixes it on the originating branch; Terra re-verifies.
7. Sol integrates only Terra-approved work and updates this board.
8. After all approved PDF tasks are integrated, settle CONTRACT-05 and run LUNA-06 last.

## In progress

No PDF-derived Luna implementation is active; all approved PDF cards are integrated. Held P3-08/P4-04 remain untouched.

## Terra review queue

- LUNA-05 - narrow viewport verification remains pending due local Mac window-control limitation.
- LUNA-02 / `b69b04f` - integrated after static Terra PASS; Computer Use desktop/narrow inspection remains manual-blocked.
- LUNA-04 / `55b971b` - integrated after static Terra PASS; Corporation-role Computer Use remains manual-blocked.

Terra handoff must contain:

```md
- Card and commit:
- Role and ward:
- Starting state:
- Computer Use actions:
- Observed result:
- PDF requirement checked:
- Evidence:
- PASS or BUG IDs:
```

## Luna bug-fix queue

### BUG-LUNA-01-2 - Demo mode permits reporting in another ward

- **Parent:** LUNA-01 / P1-03 / commit `a57ed81`
- **Severity:** P1
- **Reproduction:** In demo mode, browse a ward other than `session.wardId`; the reporting permission includes a `dataMode === "demo"` bypass.
- **Expected:** Other wards are strictly view-only in every data mode: no reporting and no voting.
- **Actual:** Voting is correctly own-ward-only, but reporting remains available in other wards under demo mode.
- **Luna fix:** Commit `1ccd1dc` removes the demo-mode reporting bypass so reporting and voting are both own-ward-only.
- **State:** Resolved; Terra static PASS; integrated with LUNA-01. Authenticated UI verification remains blocked by OTP/CAPTCHA.

### BUG-LUNA-01-1 - Vote removal reports a downvote

- **Parent:** LUNA-01 / P1-04 / commit `be758c0`
- **Severity:** P1
- **Reproduction:** In the citizen's own ward, support an issue and click Support again to remove that vote.
- **Expected:** Removing an existing vote gives truthful removal feedback; newly cast support still says `Your support was recorded`, and a newly cast downvote uses distinct downvote feedback.
- **Actual:** The vote is deleted, but every non-support result is labeled `Your downvote was recorded`.
- **Luna fix:** Commit `a57ed81` adds truthful feedback for support/downvote removal while preserving the approved new-vote copy.
- **State:** Resolved; Terra static PASS; integrated with LUNA-01.

### BUG-LUNA-00-1 - Demo finance seed is rejected by tenancy triggers

- **Parent:** LUNA-00 / commit `6d4fb38`
- **Severity:** P0
- **Reproduction:** Clean local `supabase db reset --local --no-seed` reaches the new migration and fails with `Budget editor must administer the ward municipality`.
- **Expected:** The migration inserts 28 demo budgets and four deterministic demo expenditures; real non-demo writes retain actor/tenancy validation.
- **Actual:** Existing BEFORE triggers reject the null demo actor before rows are inserted.
- **Fix:** Commit `9e9fee9`; local clean reset and invariant query passed.
- **State:** Resolved; Terra clean-reset and migration-replay PASS; integrated.

### BUG-LUNA-05-1 - CAPTCHA is not visible below the mobile input

- **Parent:** LUNA-05 / P7-04 / commit `61c9018`
- **Severity:** P1
- **Computer Use reproduction:** Open the configured signed-out app at desktop size; inspect the area between the mobile input and `Get OTP` without entering phone data.
- **Expected:** A visible CAPTCHA directly below the mobile input.
- **Actual:** The reserved area is blank; no CAPTCHA iframe/control is exposed.
- **Luna fix:** Commit `a895323`.
- **State:** Resolved on desktop by Terra; narrow page verification remains pending.

```md
### BUG-<parent>-<number> - <source requirement that failed>
- Parent card and commit:
- Severity:
- Computer Use reproduction:
- Expected from PDF/approved contract:
- Actual:
- Evidence:
- Luna fix commit:
- Terra re-verification:
```

## Integration queue

No fully reviewed card is waiting for integration.

## Done

- LUNA-00 - shared civic/finance contract and persistent database seed.
- LUNA-01 - Citizen Flow approved work and both Terra fixes; integrated as `5bc7a09`, `5c02b3c`, `395f28b` (authenticated UI verification remains blocked by OTP/CAPTCHA).
- LUNA-02 - shared Municipality Page; source `980cc59`, integrated as `b69b04f` (desktop/narrow runtime inspection remains manual-blocked).
- LUNA-03 - Parshad Desk approved work, excluding held P3-08/P4-04; source `2d32e4c`, integrated as `3bcc0b3`.
- LUNA-04 - Corporation Desk page 5–6 work; source `a841cee`, integrated as `55b971b` (Corporation-role runtime inspection remains manual-blocked).
- LUNA-05 - page-7 sign-in, messaging, favicon, and visible CAPTCHA (desktop verified; narrow verification remains tracked).
