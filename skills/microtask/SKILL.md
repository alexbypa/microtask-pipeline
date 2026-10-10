---
name: microtask
description: "Runs a group (or a single microtask) from the microtask queue (TODO.md) through a multi-agent pipeline: baseline → SOLID analysis → implementation (agent or you, in mentoring) → tests → independent review → docs → group commit; in --auto mode also push and pull request."
disable-model-invocation: true
argument-hint: "[task ID (A29) or group (G0) — optional] [--auto | --manual] [--resume]"
---
# Microtask pipeline

## Configuration (from the project's CLAUDE.md)
Look for the `## Microtask config` section in the project's `CLAUDE.md`. Missing values → defaults:

| Key | Default | Use |
|---|---|---|
| `Queue` | `TODO.md` | File with the queue table |
| `Done` | *(absent → completed tasks stay `[x]` in the queue)* | Archive file for completed tasks: the row moves here from `Queue` |
| `Branch` | `outcome_yyyyMMdd-<Group>` | Working branch: `yyyyMMdd` = today's date, `<Group>` (or `<Gruppo>`) = selected group (e.g. `outcome_20261002-G0`) |
| `Build` | **Commands** section of CLAUDE.md | Build command |
| `Test` | **Commands** section of CLAUDE.md | Test command(s) |
| `Coverage` | *(absent → no coverage)* | Test command that produces Cobertura XML coverage; when set it replaces `Test` in the baseline and step III |
| `Watch dir` | `src` | Source code folder (also used by the hook) |
| `Docs` | `README.md, CHANGELOG.md` | Documentation files to keep in sync |
| `Language` | `English` | Language of external output (code, README, CHANGELOG, commits) |
| `Social drafts` | `off` | `on` → a social post draft for every feature (step IV, `social-writer` agent) |

Build or Test not found → ask the user once and offer to add them to CLAUDE.md.

## Queue format
Table in the `Queue` file:
`| Status | ID | Group | Type | Task |` — Status: `[ ]` `[/]` `[x]` · Type: `code` `analysis` `docs` `content`. Headers may be in any language (e.g. `| Stato | ID | Gruppo | Tipo | Task |`): what matters is the column order and the Status and Type values.

## Rules
- In the pipeline, **one microtask at a time**; **commit at the end of the group**.
- Branch `Branch`, **before the baseline** (after selection, so the group is known):
  - uncommitted changes in the working tree → STOP and ask (don't mix them into the group). Exceptions: the `Queue` and `Done` files (e.g. rows added by `/microtask-pipeline:plan` or the selection's `[/]`) don't count and go into the group commit; with `--resume` the changes are the user's code, see "Resume";
  - branch exists and is **not** merged into the default branch → `git switch` and reuse it;
  - otherwise → `git fetch origin` and `git switch -c <Branch> origin/<default branch>`; if the name already exists (merged) append `-2`, `-3`…
- Max **2 rounds** of review → fix per microtask, then STOP and ask (also when the user makes the fixes, in mentoring).
- Never publish to external services (except the LLM PR review, when enabled: the diff goes to the configured provider): `content` tasks and social drafts (`outcomes/social/`) stay drafts.
- Project rules in `.claude/rules/` (if any) apply to every agent: pass them in the prompts.
- Languages.
  - **Task language** = the language of the Task column text in the selected rows (mixed languages → the majority of rows; on a tie, the first row's). The command usually arrives with no other text: the language comes from here, not from the prompt.
  - **Conversation language** = the language of the messages the user writes in words; as long as they've only launched the command, it's the task language.
  - Reports to the user, fixed phrases (gate lines, `Social draft: …`, `⚠ CI not verified…`) and files in `outcomes/microtask/`: conversation language. Fixed phrases are written here in English: translate them, keeping the meaning.
  - External output (code, README, CHANGELOG, commit message): `Language`.
  - **PR language** (body, comments, LLM review): the task language.
  - PR title = first line of the commit message, unchanged; commands, paths, type/method names and code stay unchanged.
- Subagents run in the background: while you wait, end the turn with **one line** (current step), no intermediate summaries.
- Pipeline marker: at startup `touch "$(git rev-parse --git-dir)/microtask-active"`; at every STOP (end of group or block) `rm -f` the same file. While the marker exists the doc-sync Stop hook stays quiet: doc-sync is already part of step IV.

## Selection
From `$ARGUMENTS` (space-separated tokens; `--auto` / `--manual` are the mode, see below):

| Argument | What runs |
|---|---|
| ID of a **task** (e.g. `A29`, ID column) | Only that microtask, then "End of group" and STOP |
| ID of a **group** (e.g. `G0`, Group column) | Every `[ ]` of that group, in row order, then "End of group" and STOP |
| none | First `[ ]` **from the top** (row position, not group name) → its Group, as above |

ID not found, or group with no `[ ]` → say so and stop. Mark the running microtask `[/]` in the queue.

`--resume` (with or without ID) doesn't select `[ ]` rows: it resumes the `[/]` microtask paused in mentoring (see "Resume"). No ID → the queue's `[/]` row; no `[/]`, more than one, or `outcomes/microtask/<ID>-plan.md` missing → say so and stop.

## Introduction (first output, before any question)
**Mandatory startup order:** selection → introduction → "proceed?" question → code-author question (mandatory if the group has a `code` task) → mode question (only without a flag) → branch → baseline. Never ask for the mode before the introduction. With `--resume` no introduction and no questions: go to "Resume".

Sources: selected queue rows, the code they touch (quick read, no agent), goals in the project's `CLAUDE.md` (e.g. a **Goals** section). Conversation language, short sentences, no padding. Use **exactly** this format (markdown, not a single paragraph):

```markdown
## <Group> — <short title>

### 1. Risk to the code: 🟢 Low | 🟡 Medium | 🔴 High
<1-2 lines: why (public API, core files, missing tests, CI/build touched, bugs that may surface)>

### 2. What we'll do
| ID | What changes (in plain words) |
|---|---|
| <ID> | <one line> |

### 3. Impact on <CLAUDE.md goal, e.g. "NuGet downloads">: ⬆️ High | ↗️ Medium | ➖ Low/none
<2-3 concrete lines: what someone evaluating or using the package gets (reliability, features, docs, badges, README…) and why it moves the goal. Indirect impact (e.g. tests only) → say so and explain the link.>

_Pre-analysis estimate: the step I plan may correct it._
```
Section 3 is mandatory even with low impact. `CLAUDE.md` without goals → "Impact on people using the code".

Right after, **a single** `AskUserQuestion` call with these sequential questions:
1. "Proceed with <Group>?" → `Proceed` / `Stop` (Stop → remove `[/]`, STOP).
2. "Who writes the production code?" → `Me (mentoring)` / `Agent + Senior questions` / `Agent`. **Mandatory** if the group has at least one `code` task: always asked, even in `--auto`, and no config skips it (groups with only `analysis`/`docs`/`content` → no question). Put first, marked `(recommended)`, the option suggested by the project rule `.claude/rules/mentoring-mode.md` if the project has one, otherwise by these criteria: `Me (mentoring)` for features and architectural decisions (new file, interface, endpoint, project, layer change, an area the user has never touched); `Agent` for fixes to existing code, mechanical refactors, tasks under 5 lines with no new abstractions, config, docs. In the recommended option's description, one line on why. It applies to the whole group; tests are always written by `test-runner`.
   `Agent + Senior questions` = the agent writes the code, then Step 3 on its code (see "Step 3"). Option labels are translated into the conversation language (e.g. in Italian `Io (mentoring)` / `Agent + domande da Senior` / `Agent`). Always all three options in this question: the questions of one `AskUserQuestion` arrive together (max 4), so no question may depend on the answer to another.
3. Only without `--auto`/`--manual`: "Mode?" → `Manual` / `Auto`, one line each on what it means (see below).
4. Only without `--manual` and if the LLM review is configured: "After the PR, should I ask <model @ host> for a review posted as a comment? (Auto only)" → `Yes` / `No`.

Before the `AskUserQuestion` run `node "${CLAUDE_PLUGIN_ROOT}/scripts/pr-review.mjs" --check` (reads the environment and the project's `.env`, never prints the key): exit 0 → configured, the printed line gives `<model @ host>` for question 4; otherwise no question 4, review disabled, and write the printed line (`LLM review not configured: ...`).

## Modes
- `--manual` → stops at the gates (⏸ GATE 1, ⏸ GATE 2) and waits for the user's approval. No push.
- `--auto` → no waiting at the gates: decide yourself and log it in the report (`GATE n: auto-approved` + reason). At the end of the group commit, push and pull request (step 4 of "End of group"). In mentoring the stops at II-user, review fixes and Step 3 remain; without the user's code and answers nothing moves on. With `Agent + Senior questions` Step 3 doesn't stop: the questions come at the end of the group. The mode is saved in the plan and still applies after `--resume`.
- Neither → the mode is the third question of the Introduction.

**STOP even in `--auto`** (stop, explain, wait):
- 🔴 still present after the 2 review → fix rounds;
- build or tests red that were **not already red** at baseline;
- `implementer` or `test-runner` report an out-of-plan change or a production bug;
- breaking change (plan I) or suggested `major` bump (review V);
- push or `gh` fail (step 4).

Large or out-of-scope 🟡 in `--auto`: no STOP, it becomes a follow-up in the queue (step IV) and goes in the PR Notes.
Claude Code permission prompts (e.g. `git push`, `gh pr create`) don't depend on the mode: the project's `settings.json` governs them.

## Steps by type
| Type | Steps |
|---|---|
| `code` | 0 → I → ⏸G1 → II → III → V → IV |
| `code` with `Agent + Senior questions` | 0 → I → ⏸G1 → II → III → V → Step 3 (questions only, no stop) → IV |
| `code` in mentoring | 0 → I → ⏸G1 → II-user (⏸ STOP) · `--resume` → III → V → ⏸ Step 3 → IV |
| `analysis` | 0 → I → report in `outcomes/audits/<ID>.md` → IV |
| `docs` | I (impact only) → ⏸G1 → IV → doc-sync |
| `content` | draft in `outcomes/content/<ID>.md` → ⏸G1 → IV |

**Fast lane** (`code` only, if plan I says `Lane: fast`): II (only with the `Agent` implementer; in mentoring II-user remains), III and IV are run **by you** without subagents, with the same rules as the agents (full build, warning count, green tests, queue/CHANGELOG/Docs). Still agents: I (analysis) and V (independent review). At GATE 1 show the lane: the user can ask for the full one.

### 0. Baseline (once per group)
Run a **full** `Build` (not incremental: .NET `--no-incremental`, other stacks clean first) + `Test`, or **`Coverage` if configured** (mandatory, fast lane included: never `Test` in its place). Record errors, **warning count**, **pre-existing** failures (not regressions) and, with `Coverage`, the **global production line coverage** (same rules as `test-runner`).
`Coverage` configured but no Cobertura report produced or readable → run it once more; still nothing → STOP (even in `--auto`): without a baseline there is nothing to compare against.
Coverage of test projects: every test project in the repo must be run by `Test` (.NET: every `*Tests*.csproj` in the solution used, or listed). Excluded projects → flag them in the GATE 1 plan.

### I. Analysis → agent `microtask-pipeline:solid-analyst`
Pass: microtask text, baseline, config. Receive: plan (plain explanation if a fix, files, SOLID, risk, breaking, public API snapshot, tests).
**⏸ GATE 1:** if the microtask is a fix, show the "Plain explanation" **first** (problem → why → how we fix it), in the conversation language; then the plan. Wait for approval.
Only with `Social drafts: on`: right below the plan (also in `--auto` and in the fast lane), one line on its own, outside tables and lists:
- `Nature: feature` → `Social draft: I'll create it at step IV (outcomes/social/<ID>.md)`
- otherwise → `Task <ID> is not a feature, so no social post draft`
In `--auto`: show the same text and carry on (except STOP cases). The plain explanation and the plan also feed the PR body.

### II. Implementation → agent `microtask-pipeline:implementer`
Pass: approved plan + `Build` command. Report errors only: its build is incremental, warnings aren't reliable.

### II-user. Mentoring: the user writes the code
Instead of the `implementer` agent. Step I has already done "Step 1" of `mentoring-mode` (logical overview, no code), approved at GATE 1.
1. **Step 2, signatures.** Show **only** the signatures: interfaces, classes, records, public methods **without bodies**, with the file each one goes in, and 2-4 lines on how they fit the existing architecture. List the cases `test-runner` will cover. No implementation, not even partial.
2. **Save** `outcomes/microtask/<ID>-plan.md` (conversation language), the single source for resuming:
   - approved plan from step I (public API snapshot, Lane, Nature included) and the Step 2 signatures;
   - step 0 baseline (build, warning count, tests, pre-existing failures, coverage if configured) and the `git rev-parse HEAD` it was taken on;
   - Branch, mode (`--auto`/`--manual`), LLM review choice;
   - a **Next session** section (format in "End of group") with the command `/microtask-pipeline:microtask <ID> --resume`.
3. **⏸ STOP** (even in `--auto`): ask the user to challenge the design and then write the code; show the resume command. Remove the pipeline marker; the row stays `[/]`. If the user changes the signatures, update `<ID>-plan.md` before stopping.

Other `code` microtasks in the same group: each one stops at its own II-user after the previous one's `--resume`; the group's `analysis`/`docs`/`content` microtasks run after the last one, before "End of group".

### Resume (`--resume`)
1. Read **only** `outcomes/microtask/<ID>-plan.md`, the queue row and the changed files: no new analysis.
2. `touch` the pipeline marker; `git switch` to the saved Branch if needed.
3. `git status --short`: uncommitted changes are the user's code, no STOP. Files outside the plan → list them and ask whether to include them (in `--auto`: exclude them and log it).
4. HEAD differs from the saved one (e.g. default branch merged in) → warn that the baseline may no longer be comparable and offer to redo it with `git stash` → step 0 → `git stash pop` (in `--auto`: redo it).
5. Continue from where it stopped (III after II-user, III and V after a fix round) with the saved baseline and API snapshot.

### III. Tests → agent `microtask-pipeline:test-runner`
Pass: plan + implementer summary (in mentoring: files changed by the user, from `git status --short`) + `Build`/`Test`/`Coverage` commands + baseline warnings. Must finish green, with a full build and a warning comparison (new warnings = finding).
With `Coverage` (mandatory, fast lane included):
- changed production lines not covered = 🟡 finding, handled like V findings (unless an "untestable" justification is accepted at GATE 2);
- **never worse**: global production coverage below the baseline = 🟡 finding, same handling;
- coverage missing at the end of the step = error, not `n/a`: run `Coverage` again.

### V. Review → agent `microtask-pipeline:reviewer`
Pass: the step I API snapshot (**not** the plan). Receive: issues + API diff + suggested bump.
Handling findings:

| Severity | Action |
|---|---|
| 🔴 | Back to II with the findings (max 2 rounds) |
| Small 🟡: ≤10 lines, files already touched by the microtask, no API change | Fixed in the same round as the 🔴 (no 🔴 → one round just for them, counts toward the 2) |
| Large or out-of-scope 🟡 | Proposed at GATE 2; if rejected → follow-up in the queue (step IV) |
| ⚪ | Report only, no action |

After each fix round → run III again (full build + tests) before closing.

In mentoring the user fixes the 🔴 and small 🟡: show the findings with `file:line` and the proposed fix **in words** (no code), log them in `<ID>-plan.md` with the round number, remove the pipeline marker, then ⏸ STOP with `/microtask-pipeline:microtask <ID> --resume`.

### Step 3. Senior questions (mentoring, or `Agent + Senior questions`)
After V with no 🔴: 4-5 Senior .NET Developer questions on the microtask's code (trade-offs, GC and allocations, performance, concurrency, edge cases), each anchored to `file:line`.
- In mentoring the code is the user's: the questions challenge their choices. ⏸ Wait for the answers (even in `--auto`), then comment on each in 1-2 lines. Questions, answers and comments go in `<ID>-plan.md` under `## Step 3`. Then step IV.
- With `Agent` the code is the agent's: the questions check that the user understood the reasons behind its choices (e.g. "why X instead of Y?", "what happens if…?"). **No stop**: just write the questions in the group report under `## Step 3 — <ID>` and move straight to step IV. You show them at the end of the group (point 5 of "End of group").

### IV. Memory → agent `microtask-pipeline:memory-updater`, then `microtask-pipeline:doc-sync-reviewer`
Pass: config (`Queue`, `Done`, `Docs`, `Language`) + deferred findings to turn into follow-ups. Updates the queue (`[x]` + note, or row moved to `Done`), CHANGELOG `## [Unreleased]`, `Docs`.
Only with `Social drafts: on` and only `code` with plan I `Nature: feature` → **in parallel** with `memory-updater` launch the `microtask-pipeline:social-writer` agent (fast lane included). Pass: microtask ID and text, Goal and plan I, implementer and test-runner summaries, V's API diff. It writes only the English draft `outcomes/social/<ID>.md`, never published; it goes into the group commit. Agent error → log it in the report, no STOP.
With `Social drafts: on`, every other microtask (Nature `fix`/`other`, or Type other than `code`) → no agent; the line `Task <ID> is not a feature, so no social post draft` is already at GATE 1 (Types with no step I: write it here) and comes back at GATE 2. With `off` (default) no agent and no social draft lines.
After doc-sync OK: `bash "${CLAUDE_PLUGIN_ROOT}/hooks/doc-sync-gate.sh" --mark` (stops the Stop hook from running it again).

## End of group
1. **Report** in `outcomes/microtask/<yyyy-MM-dd>-<Group>.md` (conversation language):
   - baseline → final (build, warnings, tests; with `Coverage`: global line coverage and changed lines covered N/M);
   - per microtask: what was done, gate decisions, deviations from the plan;
   - review findings: resolved / deferred;
   - follow-up tasks added to the queue;
   - social drafts (only with `Social drafts: on`): created (`outcomes/social/<ID>.md`), or the GATE 2 "not a feature" lines;
   - to check later (e.g. CI on the first push);
   - suggested bump;
   - in mentoring: link to `outcomes/microtask/<ID>-plan.md` per microtask;
   - with `Agent + Senior questions`: `## Step 3 — <ID>` sections with the questions only (see "Step 3");
   - **Next session**, last section, always, self-contained to restart from an empty context:
     ```markdown
     ## Next session
     - **Command:** /microtask-pipeline:microtask <next ID or group> --manual
     - **Next in queue:** <ID> — <task> (<type>)
     - **Decisions to carry over:** <from the gates and Step 3, max 3 lines>
     - **Open follow-ups:** <IDs added to the queue>
     - **Read first:** <files in the next task's scope, if known>
     ```
     Empty queue → `**Command:** none, queue exhausted`.
2. **Commit files**: explicit list of the files the group touched (from the step summaries + queue, `Done`, CHANGELOG, Docs, report, social drafts, `<ID>-plan.md` in mentoring). Compare it with `git status --short`: the rest goes under "excluded".
3. **⏸ GATE 2:** show `git diff --stat -- <commit files>` + new files (they don't appear in the diff), excluded files, link to the report, suggested bump, commit message (conventional, in `Language`, with Claude Code's `Co-Authored-By` trailer: AI attribution stays visible, don't remove it; if missing add `Co-Authored-By: Claude <noreply@anthropic.com>`). Then, only with `Social drafts: on`, one line per microtask, on its own: `Social draft: outcomes/social/<ID>.md` or `Task <ID> is not a feature, so no social post draft`; if no microtask in the group is a feature, also `Group <Group> is not a feature, so no social post draft`. The group touches CI or build (workflows, solution/projects, props) → add `⚠ CI not verified: check the first run after the push`. The report goes into the group commit. Commit only after confirmation, with `git add -- <commit files>` (never `git add -A` / `git add .`). Then point 5, then STOP.
   In `--auto`: show the same summary, commit without waiting and go to point 4.
4. **PR** (`--auto` only):
   - Never push to `main`/`master`: if you're there, STOP.
   - `git push -u origin <branch>`.
   - PR already open for the branch (`gh pr view --json number,url,state`) → add the body as a comment (`gh pr comment`), in the PR language (see Rules: the language of the task text in the queue). Otherwise `gh pr create --base <default branch> --title "<first line of the commit message>" --body-file <temp file>`, then, with the PR number now known, complete the file links in the body and `gh pr edit <n> --body-file <temp file>`.
   - `gh` missing/not authenticated or push rejected → STOP with the command to run by hand; the commit stays local.
   - Show the PR link.
   - LLM review (only if `Yes` was chosen at startup): `node "${CLAUDE_PLUGIN_ROOT}/scripts/pr-review.mjs" <n> --lang "<PR language>"`. It posts a comment on the PR. Error (e.g. `PR_REVIEW_API_KEY` missing, HTTP 429/5xx even after retries and the optional fallback model, API unreachable) → report to the user in chat the `LLM review failed (...)` line printed by the script, without changing the group report (already committed), no extra STOP.
   - Point 5, then STOP.
5. **Senior questions** (only with `Agent + Senior questions`): after the commit (in `--auto` after the PR), show in chat all the group's `## Step 3 — <ID>` questions, grouped by microtask, and stop the pipeline: the work is done. The user answers whenever they like, partly or not at all; comment on each answer in 1-2 lines. Answers and comments stay in the chat: no new commits.

### PR body
A **report** that explains the work to someone who didn't follow it, in the **PR language** (see Rules; independent of `Language`), short sentences; headings and labels are the ones in the example, translated into the PR language. Sources: group report, plain explanation and plan from step I, implementer and test-runner summaries.

```markdown
## <Group> — <short title>

### ⚠ Behavior changes
- <what changes for people using the code: before → now>

<details><summary><b><ID></b> — <problem in one line></summary>

**Problem:** <what used to happen, concrete example>          ← fix
**Impact:** <what it meant for the user/caller>     ← fix
**Goal:** <what it adds and why>                        ← feature / non-fix

**What we did:** <2-3 plain sentences: how it works now and what people using the code see>

| File | What changed | Why |
|---|---|---|
| [`<file name>`](https://github.com/<owner>/<repo>/pull/<n>/changes#diff-<sha256 of the path>) | <change in a few words> | <reason> |

</details>

## Verification
| | Baseline | Now |
|---|---:|---:|
| Warnings | M | N |
| Tests passed | X | Y |
| Coverage (production) | a% | b% |

## Notes
- Follow-up added: <ID> — <title>
- Social draft: `outcomes/social/<ID>.md` (features only, with `Social drafts: on`)
- Suggested bump: patch | minor | major (<reason>)
- Gates: plan (GATE 1) and diff (GATE 2) approved by the user | auto-approved in `--auto` (<reason>)
- ⚠ CI not verified (only if the group touches CI/build)
```
Rules:
- One `<details>` block per microtask in the group: on GitHub it stays collapsed showing only ID and problem, and opens on click.
- "What we did": explain the solution to someone who doesn't know the code (how it behaves now, not which lines changed). Always present, features included.
- File table: **every** commit file touched by that microtask (tests included), one row each. Queue, `Done`, CHANGELOG and group report go in Notes only, if needed.
- File links: the name links to its diff in the PR. `<owner>/<repo>` from `gh repo view --json nameWithOwner`; anchor = SHA-256 of the path relative to the repo root, e.g. `printf '%s' "src/Foo/Bar.cs" | sha256sum`. The number `<n>` is only known after `gh pr create`: see step 4.
- **No code or diffs**: they're already in the "Files changed" tab. Method/type names in backticks are fine.
- "Behavior changes": every change visible to people using the code (exceptions, return values, config read, API). None → omit the section. Present → the suggested bump accounts for them.
- Gates line: how the gates actually went, from the group report (`GATE n: auto-approved` → auto-approved). Never write "approved by the user" without their confirmation.
- Coverage row only if `Coverage` is configured (then it always has a value, see steps 0 and III). Empty sections → omit them.

## Invocation examples
- `/microtask-pipeline:microtask` → next group, asks for the mode
- `/microtask-pipeline:microtask G0 --auto` → all of G0, then commit + push + PR
- `/microtask-pipeline:microtask A29 --manual` → only A29, with the gates
- `/microtask-pipeline:microtask A29 --resume` → resumes A29 after you wrote the code (mentoring)

## Example CLAUDE.md section
```markdown
## Microtask config
- Queue: TODO.md
- Done: DONE.md
- Branch: outcome_yyyyMMdd-<Group>
- Build: dotnet build src/MySolution.slnx -c Release
- Test: dotnet test src/MyProject.Tests
- Coverage: dotnet test src/MySolution.slnx -c Release --collect "Code Coverage;Format=cobertura" --results-directory TestResults/coverage
- Watch dir: src
- Docs: README.md, CHANGELOG.md, docs/
- Social drafts: on    # optional: default off
```
