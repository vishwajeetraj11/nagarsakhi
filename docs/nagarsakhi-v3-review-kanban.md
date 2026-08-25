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

## Source-verified requirement register

### Page 1 - Citizen flow

- Citizen Overview contains latest updates, in-progress issues, issue reporting, and access to the Parshad profile.
- There are three ways to report an issue: Overview, Issues, and Report; remove reporting from Overview.
- Citizens can view other wards but make no updates.
- There are two ward-browsing controls (`Wards` and `Browse wards`); remove the duplication.
- Upvoting and downvoting show the same popup; downvoting needs a different option/message.
- Support confirmation shown in the note: `Your support was recorded`.

### Page 2 - Issues and municipality page

- The Issues page should allow clicking between issue progress statuses.
- Clicking an issue should open its report.
- Add a common read-only Phusro Nagar Parishad page for all roles.
- The common page contains municipality details.
- NagarSakhi should be clickable and open that common page.

### Page 3 - Municipality and Parshad

- Add a Phusro Municipal Corporation home page.
- Show names for all ward Parshads.
- Show temporary ward-fund and commitment numbers.
- Show a term number next to the ward representative.
- Parshad login opens Parshad Desk and shows fixed issues.
- The Issue Register is cluttered; add filters.
- Remove `Required follow-ups` from Ward Calendar.
- Change the order of Ward Calendar and Resident Notice.
- Add a real calendar with date selection.
- Add `View as Citizen`.
- Show a missing municipality-wide notice at the top of the Parshad view.

### Page 4 - Parshad card and public work account

- Change the representative card to `Ward Parshad`.
- Make the Parshad name the profile link.
- Show the actual term number; the sketch uses `2nd term`.
- Public Work Account shows ward funds and commitments.
- Recent Spending should temporarily show a fixed issue with a cost.
- Ward Tasks replacing Ward Calendar is marked for discussion, not as a settled requirement.

### Page 5 - Corporation Official

- Corporation Official login opens Corporation Desk.
- Choosing a ward opens its ward view.
- Show ward work by status.
- Ward Budget needs to be synchronized.
- Ward Activity is not color coded; update it with tags.
- Rename `Corporation Overview` to `Municipal Overview`.
- Show Escalated Issues with Ward, Parshad, Issue, Request, Status, and Ward View information.
- Remove the redundant standalone `Ward 7` element shown in the sketch.

### Page 6 - Corporation dashboard

- Replace the zero Public Spending display with an approved temporary value between ₹3-5 crore.
- Remove Operational Alerts because they have no point right now.
- Let Public Notices take the entire available width.

### Page 7 - UI/UX and sign-in

- Use the NagarSakhi identity shown in the sketch.
- Copy: `Your ward, in the open`.
- Copy: `See what's happening in your ward`.
- Copy: `Make sure your voice counts`.
- Copy explains: file issues, vote on priorities, track ward work, and see where the budget goes.
- Copy: `Private sign-in. Public accountability.`
- Secure sign-in uses a registered mobile number.
- Mobile input shows `+91`.
- CAPTCHA appears below the mobile input.
- The action is `Get OTP`.
- Add a favicon.

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

## Parallel dispatch order - SOL

1. Sol settles CONTRACT-01 through CONTRACT-04 and records the exact decisions here.
2. Run LUNA-00 and LUNA-05 in parallel because their conflict keys differ.
3. After LUNA-00, run LUNA-01, LUNA-02, and LUNA-03 in parallel because their conflict keys differ.
4. Run LUNA-04 only after LUNA-03 is integrated because both touch `official-ui`.
5. Send every completed Luna branch to a Terra agent for Computer Use verification.
6. Terra reports one bug card per reproducible defect; Luna fixes it on the originating branch; Terra re-verifies.
7. Sol integrates only Terra-approved work and updates this board.

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
