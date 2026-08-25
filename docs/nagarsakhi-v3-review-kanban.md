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
| 1 | - | - | Idle | - | No agent dispatched | Available |
| 2 | - | - | Idle | - | No agent dispatched | Available |
| 3 | - | - | Idle | - | No agent dispatched | Available |

### Live-state vocabulary

- `AWAITING GO-AHEAD` - present in the PDF board but not approved.
- `APPROVED` - approved by the user and waiting for dispatch/dependencies.
- `IN PROGRESS` - Luna is implementing it.
- `NEEDS INPUT` - an agent is paused on a contract question.
- `TERRA REVIEW` - implementation is being verified through Computer Use.
- `FIXING BUG-N` - Luna is fixing a Terra finding.
- `READY TO INTEGRATE` - Terra passed it; Sol has not integrated it yet.
- `DONE` - integrated by Sol.
- `SKIPPED` - explicitly excluded by the user.

### Skip and resume controls

- Say `Skip P3-06` to skip one task, or `Skip page 3` to skip every unfinished task on that page.
- Say `Resume P3-06` to return a skipped task to `AWAITING GO-AHEAD`.
- If the task is active, Sol tells the agent to stop that exact scope and preserve other approved work in the packet.
- If skipping breaks another approved task's dependency, Sol marks the dependent task `NEEDS INPUT` instead of inventing replacement behavior.
- Skipped tasks are never silently reintroduced during bug fixing or integration.

## Contract gate - Sol must settle before dependent work

### CONTRACT-01 - Canonical municipality name

- **Source:** OPEN, pages 2-3
- Page 2 says `Phusro Nagar Parishad`.
- Page 3 says `Phusro Municipal Corporation`.
- **Decision required:** Select the canonical public name and whether alternate wording remains anywhere.
- **Blocks:** LUNA-00, LUNA-02, LUNA-04

### CONTRACT-02 - Other-ward read-only boundary

- **Source:** PDF p1
- Exact intent: citizens can view other wards but make no updates.
- **Decision required:** Define `no updates` against the actions that already exist in the product. Do not invent new actions.
- **Blocks:** LUNA-01

### CONTRACT-03 - Placeholder public finance values

- **Source:** OPEN, pages 3, 4, and 6
- Page 3 asks for random ward-fund and commitment numbers.
- Page 4 asks for a fixed issue with a random cost `for now`.
- Page 6 asks to replace zero public-spending values with a random number between ₹3-5 crore.
- **Decision required:** Approve exact temporary values and how they are labeled. Do not generate new random values on each render.
- **Blocks:** LUNA-00, LUNA-02, LUNA-03, LUNA-04

### CONTRACT-04 - Calendar versus Ward Tasks

- **Source:** OPEN, page 4
- The note says `Ward Tasks ? Discussion?` and suggests it can replace Ward Calendar, possibly with Aadhaar verification or something similar.
- **Decision required:** Either keep the page 3 calendar change or replace it with a separately defined Ward Tasks contract. Aadhaar verification is not approved by the PDF note alone.
- **Blocks:** The calendar/task portion of LUNA-03

### CONTRACT-05 - Public Parshad phone-number source and placement

- **Source:** USER request, 25 Aug 2026; not in the PDF
- Add phone numbers for the Parshad of each ward as the final delivery task.
- **Decision required later:** Provide or approve the authoritative source, confirm that each number is an official public contact number, and choose where it appears.
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
| [ ] | P1-01 | Remove issue reporting from Overview; Issues and Report remain the other two reporting paths. | LUNA-01 | None |
| [ ] | P1-02 | Remove the duplicate ward-browsing control (`Wards` versus `Browse wards`). | LUNA-01 | None |
| [ ] | P1-03 | Let citizens view other wards but make no updates there. | LUNA-01 | CONTRACT-02 |
| [ ] | P1-04 | Give downvoting feedback different from support feedback; preserve `Your support was recorded` for support. | LUNA-01 | None |

**Page status:** Awaiting go-ahead

### PDF page 2 - Issues and common municipality page

| Go ahead | ID | Task from page 2 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [ ] | P2-01 | Allow selection between issue progress statuses on the Issues page. | LUNA-01 | None |
| [ ] | P2-02 | Open an issue's report when that issue is selected. | LUNA-01 | None |
| [ ] | P2-03 | Add a common read-only municipality page for all roles. | LUNA-02 | CONTRACT-01 |
| [ ] | P2-04 | Show municipality details on the common page. | LUNA-02 | CONTRACT-01 |
| [ ] | P2-05 | Make NagarSakhi clickable and open the common municipality page. | LUNA-02 | CONTRACT-01 |

**Page status:** Awaiting go-ahead

### PDF page 3 - Municipality and Parshad

| Go ahead | ID | Task from page 3 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [ ] | P3-01 | Add the Phusro municipality home page. | LUNA-02 | CONTRACT-01 |
| [ ] | P3-02 | Show names for all ward Parshads. | LUNA-00, LUNA-02 | None |
| [ ] | P3-03 | Show approved temporary ward-fund and commitment numbers. | LUNA-00, LUNA-02 | CONTRACT-03 |
| [ ] | P3-04 | Show a term number next to the ward representative. | LUNA-00, LUNA-02 | None |
| [ ] | P3-05 | Keep Parshad login opening Parshad Desk and showing fixed issues. | LUNA-03 | None |
| [ ] | P3-06 | Add filters to the cluttered Issue Register. | LUNA-03 | None |
| [ ] | P3-07 | Remove `Required follow-ups` from Ward Calendar. | LUNA-03 | None |
| [ ] | P3-08 | Change the order of Ward Calendar and Resident Notice, and add a real date-selectable calendar. | LUNA-03 | CONTRACT-04 |
| [ ] | P3-09 | Add `View as Citizen` to the Parshad experience. | LUNA-03 | None |
| [ ] | P3-10 | Show the missing municipality-wide notice at the top of the Parshad view. | LUNA-03 | None |

**Page status:** Awaiting go-ahead

### PDF page 4 - Parshad card and public work account

| Go ahead | ID | Task from page 4 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [ ] | P4-01 | Use `Ward Parshad`, make the Parshad name the profile link, and show the actual term number; the sketch uses `2nd term`. | LUNA-00, LUNA-03 | None |
| [ ] | P4-02 | Show ward funds and commitments in Public Work Account. | LUNA-00, LUNA-03 | CONTRACT-03 |
| [ ] | P4-03 | Temporarily show a fixed issue with an approved cost in Recent Spending. | LUNA-00, LUNA-03 | CONTRACT-03 |
| [ ] | P4-04 | Decide whether Ward Tasks replaces Ward Calendar; the PDF marks this for discussion and mentions Aadhaar verification only as an uncertain example. | Sol | CONTRACT-04 |

**Page status:** Awaiting go-ahead

### PDF page 5 - Corporation Official

| Go ahead | ID | Task from page 5 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [ ] | P5-01 | Keep Corporation Official login opening Corporation Desk; choosing a ward opens its ward view. | LUNA-04 | None |
| [ ] | P5-02 | Show ward work by status. | LUNA-04 | None |
| [ ] | P5-03 | Synchronize Ward Budget. | LUNA-00, LUNA-04 | CONTRACT-03 |
| [ ] | P5-04 | Update Ward Activity with tags/color coding. | LUNA-04 | None |
| [ ] | P5-05 | Rename `Corporation Overview` to `Municipal Overview`. | LUNA-04 | CONTRACT-01 |
| [ ] | P5-06 | Show Escalated Issues information for Ward, Parshad, Issue, Request, Status, and Ward View. | LUNA-04 | None |
| [ ] | P5-07 | Remove the redundant standalone `Ward 7` element shown in the sketch. | LUNA-04 | None |

**Page status:** Awaiting go-ahead

### PDF page 6 - Corporation dashboard

| Go ahead | ID | Task from page 6 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [ ] | P6-01 | Replace the zero Public Spending display with an approved temporary value between ₹3-5 crore. | LUNA-00, LUNA-04 | CONTRACT-03 |
| [ ] | P6-02 | Remove Operational Alerts because they have no point right now. | LUNA-04 | None |
| [ ] | P6-03 | Let Public Notices take the entire available width. | LUNA-04 | None |

**Page status:** Awaiting go-ahead

### PDF page 7 - UI/UX and sign-in

| Go ahead | ID | Task from page 7 | Agent/card | Contract dependency |
| --- | --- | --- | --- | --- |
| [ ] | P7-01 | Apply the NagarSakhi identity and the source messages: `Your ward, in the open`, `See what's happening in your ward`, and `Make sure your voice counts`. | LUNA-05 | None |
| [ ] | P7-02 | Explain: file issues, vote on priorities, track ward work, and see where the budget goes. | LUNA-05 | None |
| [ ] | P7-03 | Use `Private sign-in. Public accountability.` | LUNA-05 | None |
| [ ] | P7-04 | Present secure registered-mobile sign-in with `+91`, CAPTCHA below the input, and `Get OTP`. | LUNA-05 | None |
| [ ] | P7-05 | Add a favicon. | LUNA-05 | None |

**Page status:** Awaiting go-ahead

## Ready after contracts - delivery cards

### LUNA-00 - Shared civic and finance contract implementation

- **Status:** Blocked by CONTRACT-01 and CONTRACT-03
- **Conflict key:** `data-contract`
- **Branch:** `codex/v3-civic-contracts`
- **Worktree:** `../nagarsakhi-wt-v3-civic-contracts`
- **Source:** PDF pages 2-6
- **Scope:** Implement only the approved shared municipality name, ward/Parshad names, term numbers, ward funds, commitments, recent-spending value, and public-spending value needed by downstream cards.
- **Do not add:** New civic fields, new finance behavior, or new identity requirements not approved in the contract gate.
- **Handoff:** Commit, changed files, approved contract mapping, typecheck/lint/build results.

### LUNA-01 - Citizen flow changes

- **Status:** Blocked by CONTRACT-02
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

- **Status:** Blocked by CONTRACT-01, CONTRACT-03, and LUNA-00
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

- **Status:** Blocked by CONTRACT-03; calendar portion also blocked by CONTRACT-04
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

- **Status:** Blocked by CONTRACT-01, CONTRACT-03, LUNA-00, and integrated LUNA-03
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

- **Status:** Ready
- **Conflict key:** `auth-brand`
- **Branch:** `codex/v3-auth-brand`
- **Worktree:** `../nagarsakhi-wt-v3-auth-brand`
- **Source:** PDF page 7
- **Scope:** Apply only the source-verified messages, registered-mobile sign-in treatment, `+91`, CAPTCHA placement, `Get OTP`, NagarSakhi identity treatment, and favicon.
- **Do not add:** New authentication methods, new brand claims, or identity-verification requirements.
- **Computer Use verification:** Signed-out UI at narrow and desktop sizes. CAPTCHA interaction remains a user handoff when required.

### LUNA-06 - Verified Parshad phone numbers for every ward

- **Status:** Final task; blocked by CONTRACT-05 and completion of approved PDF tasks
- **Conflict key:** `parshad-contact`
- **Branch:** `codex/v3-parshad-phone-numbers`
- **Worktree:** `../nagarsakhi-wt-v3-parshad-phone-numbers`
- **Source:** USER request, 25 Aug 2026; not in the PDF
- **Scope:** Add the verified official public phone number for each ward's Parshad in the placement approved by CONTRACT-05.
- **Do not add:** Invented numbers, private numbers, numbers without a ward/Parshad match, or additional contact fields.
- **Computer Use verification:** Inspect every ward and compare the displayed Parshad-number pairing with the approved source.

## Parallel dispatch order - SOL

1. Sol settles CONTRACT-01 through CONTRACT-04 and records the exact decisions here.
2. Run LUNA-00 and LUNA-05 in parallel because their conflict keys differ.
3. After LUNA-00, run LUNA-01, LUNA-02, and LUNA-03 in parallel because their conflict keys differ.
4. Run LUNA-04 only after LUNA-03 is integrated because both touch `official-ui`.
5. Send every completed Luna branch to a Terra agent for Computer Use verification.
6. Terra reports one bug card per reproducible defect; Luna fixes it on the originating branch; Terra re-verifies.
7. Sol integrates only Terra-approved work and updates this board.
8. After all approved PDF tasks are integrated, settle CONTRACT-05 and run LUNA-06 last.

## In progress

No card is currently assigned.

## Terra review queue

No card is awaiting review.

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

No bugs reported.

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

No card is approved for integration.

## Done

No v3 delivery card is integrated.
