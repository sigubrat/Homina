---
name: schedulable-command
description: Make an existing Homina command available under /schedule so it posts automatically on an interval or at end of season. Use when asked to add a command to scheduling or change scheduled-command options.
---

# Make a command schedulable

Reference: `seasonTokens.ts` + its `SCHEDULABLE` entry in `src/lib/scheduler/schedulableCommands.ts`.

## 1. Extract a renderer in the command file

Export a pure render function that needs no interaction:

```ts
export interface XyzOptions { rarity?: string; }

export async function renderXyzMessage(
    ownerUserId: string,
    options: XyzOptions = {},
): Promise<{ embeds: EmbedBuilder[]; files?: AttachmentBuilder[] }> {
    // always current season (getCurrentSeason()); no season option in schedules
    // return a red "No data found..." embed instead of throwing when empty
}
```

Prefer having `execute` reuse shared helpers with the renderer rather than duplicating chart/embed code further (the existing commands duplicate; don't make it worse).

## 2. Register in `SCHEDULABLE`

Add an entry to the `SCHEDULABLE` array in `src/lib/scheduler/schedulableCommands.ts`:

- `name`: same as the slash command name; becomes `/schedule <name>`.
- `buildAddSubcommand`: wrap with `addEndOfSeasonOption(addStartTimeOption(sc...))`; always include the required `channel` option and optional `every-hours` (1–168), then command-specific options. Subcommand descriptions ≤ 100 chars.
- `parseAddOptions`: use `parseIntervalOptions(interaction)`; serialize command options with `JSON.stringify` (or `null` when none). Keep option keys stable — they are persisted in `scheduledCommands.optionsJson`.
- `renderer`: `JSON.parse(ctx.optionsJson ?? "{}")` → call `renderXyzMessage(ctx.ownerUserId, opts)`.
- `formatOptions` (if it has options): short human summary for list/autocomplete, `""` when empty.

`/schedule` (`src/commands/utility/schedule.ts`) picks it up automatically via `SCHEDULABLE_MAP`.

## 3. Finish

- Tests, `bunx tsc --noEmit`, `bun run lint`.
- CHANGELOG entry ("`/schedule xyz` is now available").
- Remind the user to `bun run deploy` (the `/schedule` command definition changed).
