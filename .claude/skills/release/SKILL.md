---
name: release
description: Prepare a Homina release — pick the semver bump, write the CHANGELOG entry in the project's voice, bump package.json. Use when asked to bump the version, cut a release, or write release notes/changelog.
disable-model-invocation: true
---

# Release

1. **Find what changed** since the last release: the last `chore: bump version` commit (`git log --oneline -30`) or the top `## [x.y.z]` in `CHANGELOG.md`. Read the diffs, not just commit titles.
2. **Pick the bump** (current version is in `package.json`):
   - patch — fixes, tuning, config tweaks
   - minor — new commands/options/schedulable commands, new meta teams, user-visible features
   - major — only if the user says so
   Confirm the chosen version with the user if it's not obvious.
3. **CHANGELOG.md** — insert at the top, below the header:

   ```md
   ## [x.y.z]

   Optional short, casual intro paragraph addressed to guild users (first person, light humour is fine).

   ### Added
   - ...
   ### Changed
   - ...
   ### Fixed
   - ...
   ```

   No dates. Only include non-empty sections. Write for Discord users, wrap command names in backticks (`/season-tokens`), skip internal refactors/tests.
4. **package.json** — update `"version"`.
5. **Commits** (only if the user asked to commit): `chore: update changelog for version x.y.z` then `chore: bump version to x.y.z in package.json`, or one combined `chore: bump version x.y.z`.
6. Remind the user about `bun run deploy` if any command definitions changed and `bun run migrate` if any migration was added in this release.
