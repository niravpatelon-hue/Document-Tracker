# Document-Tracker

## Working agreement

- This is a remote/ephemeral dev environment — uncommitted work does not survive between sessions.
- After finishing each feature or discrete task, commit it and push to the current branch immediately, without asking for confirmation first. Use a clear, descriptive commit message per feature (small, scoped commits — not one giant commit at the end).
- Only skip this for genuinely half-finished, broken, or exploratory work that shouldn't land in history yet.

## Context efficiency

Keep this file as the single source of truth for project state, so a new session can orient by reading this file instead of re-exploring the whole codebase.

- Update **Architecture** and **Decisions log** below every time a feature lands — one or two bullet lines, not prose. Terse beats thorough here.
- Point to locations (`path/to/file.ts:42`), don't paste code or duplicate explanations already visible in the code itself.
- Prefer Grep/Glob for targeted lookups over reading whole files or directories when the answer is knowable from this file.
- If a decision is superseded, replace/delete the old bullet — don't accumulate a change history of the docs themselves.

## Architecture

_TBD — filled in once the stack is chosen._

## Decisions log

_None yet._
