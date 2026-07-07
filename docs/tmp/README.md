# `docs/tmp/`

Opt-in scratch notes for multi-session feature work. **Inactive by default.**

Agents: full rules in `.cursor/rules/docs-tmp.mdc` — load **only** when the user names `docs/tmp` or when continuing a feature listed in `.active`.

## `.active`

Single-line file at `docs/tmp/.active` — kebab-case feature name (e.g. `security`). Present **only** while tmp is enabled for that feature. Delete with the feature subfolder on teardown.

## Layout

```
docs/tmp/
  .active              ← feature name when tmp is on; absent = tmp off
  security/
    STATUS.md          ← required while active
  README.md
```

## `STATUS.md` template

Copy into `docs/tmp/<feature>/STATUS.md` on activation:

```markdown
# <feature> — working status

**Last updated:** YYYY-MM-DD
**Repos:** website | voice-agent | both
**Canonical docs:** (e.g. docs/security.md)

## Current focus
- Phase / goal (one short paragraph)

## Done
- [ ] …

## Next agent action
1. …

## Files touched
- `path` — why

## Env / infra
- `VAR` — notes

## Decisions
- …

## Linked notes
- (optional extra .md files in this folder)
```

Human readers: ignore this folder unless `.active` exists.
