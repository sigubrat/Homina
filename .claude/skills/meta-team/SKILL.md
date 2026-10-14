---
name: meta-team
description: Update Homina's meta team definitions — add/remove a character from a team (Multihit, Admech, Neuro, Custodes, Lavstodes, Battlesuit), change lynchpin requirements, add a new character id, or add an entirely new meta team. Use for requests like "add X to the admech team" or "X is an alternative to Y".
---

# Meta team changes

## Character ids

`src/lib/configs/charactersConfig.ts` maps `PascalName: { id, name }`, grouped by faction comments. The `id` is the Tacticus API unit id (e.g. `admecManipulus`). If a character is missing, add it under its faction; ask the user for the id if you can't find it in the code or fixtures — never guess.

## Add/remove a character from a team

Edit the roster array in `src/lib/configs/metaTeamConfig.ts` (`multiHitTeam`, `mechTeam`, `neuroTeam`, `custodesTeam`, `lavstodesTeam`, `battlesuitTeam`). Append; keep `characters.X.id` form. A team is detected when a lineup has ≥ `META_TEAM_THRESHOLD` members of the roster plus all lynchpins.

Commit as `chore: add <name> to <team> team` (one team per commit is the existing habit).

## Lynchpins and alternatives

`lynchpinHeroes` in the same file: each entry is required. A nested array means "any one of these" — e.g. `[characters.Actus.id, characters.Anuphet.id]`. When adding an alternative, make sure the alternative is also in the team roster.

Add tests to `src/test/utils/metaTeamUtilsSuite.test.ts` (`hasLynchpinHeroes` cases) proving both the original and the alternative satisfy the requirement and that missing both fails.

## New meta team (larger change)

Follow how Lavstodes was added (`git show 5d2f691`). Touchpoints:

- `src/models/enums/MetaTeams.ts` — enum value
- `src/lib/configs/metaTeamConfig.ts` — roster + `lynchpinHeroes` key
- `src/lib/utils/metaTeamUtils.ts` — `TeamCheck`, `inTeamsCheck`, classification
- `src/models/types/MetaComps.ts`, `src/models/types/TeamDistribution.ts` — new fields
- `src/lib/services/MetaTeamService.ts` — distribution/damage summaries
- `src/lib/services/ChartService.ts` — colours/labels in meta charts
- `src/commands/guild-raid/memberStatsBySeason.ts` and any other command listing teams (grep an existing team name, e.g. `custodes`, case-insensitive)
- `src/test/testFixtures.ts` + `metaTeamUtilsSuite.test.ts`

## Verify

`bun test src/test/utils/metaTeamUtilsSuite.test.ts`, then full `bun test` and `bunx tsc --noEmit`. Add a `### Changed` CHANGELOG bullet explaining the change in player terms.
