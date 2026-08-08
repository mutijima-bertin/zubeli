---
name: subagent-delegation
description: "Use when the job assigned to you is too big for one pass: split it into focused child sub-agents (photographer model) — one task per child, children report ONLY to their parent, parent verifies each result and aggregates. Also use when parallel read-only reviews or specialist fixes are needed inside your own task."
---

# Sub-Agent Delegation (photographer model)

When a job is too big for one pass, hire helpers — just like a photographer who takes on a huge shoot and brings in other photographers. The helpers report to YOU, and you report to the owner.

## When to delegate
- The task has 3+ clearly separable sub-jobs (e.g. verify 3 areas, fix 2 files in different domains, review 4 concern areas).
- The task needs a specialist you are not (e.g. you hit a backend bug — spawn `backend-agent`; a build failure — spawn `build-error-resolver`).
- Parallel read-only analysis is faster than sequential (spawn reviewers/`explore` in parallel).

## Rules
1. **One child = one task.** Never send one child a multi-domain bundle. If it spans domains, split into multiple children.
2. **Precise brief.** Every child gets: goal, files in scope (exact paths), contract files to read, how to verify, and EXACTLY what to report back. Copy the orchestrator's brief discipline.
3. **Children report ONLY to you.** Their final message is their report. You own the result — you verify what they did before you report up.
4. **Scope lock.** A child may only touch files inside its own brief. If it needs something outside, it reports back and YOU decide (re-brief, new child, or ask the orchestrator). No improvisation.
5. **Depth cap 2.** You may hire children; children may hire grandchildren only with your approval, and never deeper. Beyond that, report up instead.
6. **Track with todos.** `todowrite` the child checklist; mark each child done only after its claim is verified.
7. **Verify before green.** Re-run the check a child claims fixed (test/tsc/lint). Do not trust claims — trust evidence.
8. **Report.** Your report to the owner names each child, its result, and your verification. Write the summary file too (see AGENTS.md "Agent reports").

## Child brief template
```
Goal: <what the child must deliver>
Scope: <exact files/dirs it may touch>
Contracts to read: <AGENTS.md, docs/SCREENS.md, prisma/schema.prisma, types/*, ...>
Verify: <exact commands to prove done>
Report back: <evidence, files changed, anything blocking>
```

## Do NOT
- Do not spawn children for work that fits one pass — one shot is faster and cheaper than delegation.
- Do not let children edit files outside the parent's ownership scope (route ownership still applies per docs/SCREENS.md).
- Do not bypass the orchestrator's switchboard for top-level dispatch; delegation here is INSIDE your assigned task.
- Do not spawn children that push to git or publish anything (guardrail: only the user may approve pushes).

## Related
- AGENTS.md "Delegation & reports"; tdd-workflow (evidence); e2e-testing (verification); backend-patterns / frontend-patterns (scope).