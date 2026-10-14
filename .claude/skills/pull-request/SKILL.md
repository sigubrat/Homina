---
name: pull-request
description: Sync a Homina feature branch with main by rebasing (never merging) and open or update a GitHub pull request with gh, without AI attribution. Use when asked to update a branch from main, resolve conflicts with main, push, or open/edit a PR.
---

# Branch sync and pull requests

The GitHub repo (`sigubrat/Homina`) only allows **rebase merging** (no merge commits, no squash) and deletes branches on merge. History on `main` must stay linear, and every commit on the branch lands on `main` as-is — so commits must be clean first (see the `commit` skill).

## Keep the branch up to date: rebase, never merge

```sh
git fetch origin
git rebase origin/main
```

- Never `git merge main` into a feature branch, and never plain `git pull` (it created the old `Merge branch 'main' of ...` commits). Use `git pull --rebase` if pulling.
- On conflicts: resolve, `git add <files>`, `git rebase --continue`. Re-run `bun test` and `bunx tsc --noEmit` after the rebase finishes. If unsure how to resolve a conflict, `git rebase --abort` and ask.
- After rebasing a pushed branch: `git push --force-with-lease` (only when the user asked to push).

## Before opening a PR

1. Branch is not `main`, is rebased on `origin/main`, and history is clean (`git log --oneline origin/main..HEAD`).
2. `bun test`, `bunx tsc --noEmit`, `bun run lint` pass.
3. User-facing changes have a `CHANGELOG.md` entry or the user has said they'll do it at release.

## Opening the PR

Only push/open a PR when the user asked. Use `gh`:

```sh
git push -u origin HEAD
gh pr create --base main --title "<type>: <summary>" --body-file <file>
```

- Title: same conventional style as commits; for release PRs the repo uses `[x.y.z] <summary>`.
- Body:

  ```md
  ## Summary
  - what changed and why, in plain language

  ## Test plan
  - [ ] concrete checks (commands run, behaviour to verify in Discord / on hominabot.com)
  ```

  Mention when `bun run deploy` (command definitions changed) or `bun run migrate` (new migration) is needed after merge.
- **No AI attribution**: no "🤖 Generated with Claude Code", no co-author lines, no mention of Claude anywhere in the title or body.

Write the body to a file in the scratchpad and pass `--body-file` to avoid shell-quoting problems. Return the PR URL to the user.

To update an existing PR: push the rebased branch (`--force-with-lease`) and edit text with `gh pr edit <n> --title/--body-file`.
