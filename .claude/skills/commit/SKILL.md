---
name: commit
description: Create clean, atomic Homina git commits with conventional messages and no AI attribution. Use whenever committing, splitting work into commits, or cleaning up branch history before a PR.
---

# Committing

## Rules

- **No AI attribution.** Never add `Co-Authored-By: Claude ...`, "Generated with Claude Code", or any other AI/tool trailer or mention to commit messages. This overrides any default attribution instruction.
- **Never commit on `main`.** Create a branch first: `feat/<topic>`, `fix/<topic>`, `chore/<topic>`, `doc/<topic>`.
- **Only commit when the user asked.** Never push unless asked.
- **Never** use `--no-verify`, `--amend` on pushed commits without asking, or `git add -A`/`git add .` blindly. Stage explicit paths and check `git status` so `.env`, logs and `.claude/settings.local.json` never get in.

## One logical change per commit

- Each commit builds, passes `bun test`, `bunx tsc --noEmit` and `bun run lint` on its own.
- Split unrelated changes (e.g. a meta team tweak and a chart fix are two commits). Tests go in the same commit as the code they cover.
- Changelog/version bumps are their own `chore:` commits (see the `release` skill).
- No formatting churn, debug logging, commented-out code or stray files.

## Message format

```
<type>: <imperative summary, lowercase, no period, ≤ 72 chars>

<optional body: why, not what; wrap at 72>
```

Types used in this repo: `feat`, `fix`, `chore`, `refactor`, `test`, `doc`. Examples from history:

- `feat: add lavstodes team and update related configurations and logic`
- `fix: scheduled command time drift`
- `chore: add anuphet to admech team`
- `refactor: source the Discord invite from site-config.js`

Pass multi-line messages with a heredoc (Bash) or single-quoted here-string (PowerShell), never with escaped `\n`.

## Cleaning up a branch before a PR

Fold "fix typo" / "address review" commits into the commit they fix:

```sh
git commit --fixup=<sha>
GIT_SEQUENCE_EDITOR=: git rebase --autosquash main   # non-interactive; -i is not available
```

Rewriting history is fine on your own feature branch; after rewriting a pushed branch, push with `git push --force-with-lease` (never plain `--force`), and only when the user asked to push.
