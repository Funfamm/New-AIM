# Token Budget Manager

Use this command before starting any large or multi-file task to protect context budget and keep the session efficient.

---

## Pre-Task Checklist

Before editing any code, answer all of the following in 5 lines or less:

1. **Goal** — What is the single outcome of this task?
2. **Files needed** — List only the files that must be read or changed.
3. **Files not needed** — Explicitly name what to skip (other pages, reference repos, unrelated components).
4. **Estimated risk** — Low / Medium / High. What could break?
5. **Code changes required?** — Yes / No. If No, this is inspection only — do not edit.

Do not proceed until this checklist is answered.

---

## Reading Rules

- Read only the files listed in "Files needed" above.
- Do not scan the entire repo unless the task explicitly requires it.
- Do not open reference repos unless the user asks. If you must, read only:
  - `README.md`
  - `CLAUDE.md`
  - `docs/` or `examples/` folders
  - The single relevant component file
- Never dump full file contents into the chat. Summarize what you found.
- If a file is unchanged from a previous read this session, do not re-read it.

---

## Context Size Rules

- Keep all responses concise. One paragraph per finding. No multi-page explanations.
- If the conversation context is growing large (many files read, many rounds of edits), stop and say:
  > "Context is getting large. Recommend running /compact before continuing."
- After /compact, re-read only the files needed for the next step — not everything from before.

---

## Per-Task Output Format

After completing any task, write a short memory summary in this format:

```
TASK COMPLETE
─────────────
What changed:   [one sentence]
Files changed:  [list]
Build result:   ✓ Pass / ✗ Fail — [error if fail]
Next safe step: [one sentence]
```

Do not write paragraphs. Do not summarize the entire session history. Only the current task.

---

## Reference Repo Rules

Reference repos live at `C:\Users\mxz\Desktop\ai-agent-repos\`.

- Do not load all repos at once.
- Do not read a reference repo unless the user asks for it by name.
- When reading a reference repo, read at most 2–3 files per repo per session.
- Use reference repos for inspiration only — never copy entire systems or patterns wholesale.
- Active GSD reference: `get-shit-done-redux`

---

## One Task at a Time

- One component or page per design task.
- One feature per coding task.
- Do not refactor surrounding code while fixing a bug.
- Do not add error handling, fallbacks, or abstractions beyond what the task requires.
- Confirm the task is done (build passes, visual check noted) before starting the next one.
