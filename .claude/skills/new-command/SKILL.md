---
name: new-command
description: Add or change a Homina slash command end to end — command file, service logic, tests, docs site, changelog. Use when asked to create a new /command, add an option to an existing one, or rename/remove a command.
---

# New or changed slash command

## 1. Command file

Create `src/commands/<category>/<camelCaseName>.ts`. Categories: `guild-raid` (analytics), `guild-management` (admin/tokens/members), `user` (register/delete), `utility`. Auto-discovered — no registry to edit.

Copy the shape of a close sibling (e.g. `src/commands/guild-raid/seasonTokens.ts` for chart commands, `tokensBurnt.ts` for simple embeds):

```ts
export const cooldown = 5;
export const data = new SlashCommandBuilder()
    .setName("kebab-case-name")
    .setDescription("≤100 chars");
    // season option: .addNumberOption(o => o.setName("season")...setMinValue(MINIMUM_SEASON_THRESHOLD))
    // rarity option: reuse the Rarity choices list used in seasonTokens.ts

export async function execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply();
    // validate: isInvalidSeason(season) → editReply with message, return
    logger.info(`${interaction.user.username} attempting to use /name ...`);
    try {
        // call services with interaction.user.id as the owner/discordId
        // map API user ids → display names via userUtils
        await interaction.editReply({ embeds: [embed], files });
        logger.info(`${interaction.user.username} successfully used /name`);
    } catch (error) {
        await handleCommandError(interaction, error);
    }
}
```

- Embed: `.setColor("#0099ff")`, `.setTimestamp()`, `.setFooter({ text: STANDARD_FOOTER_TEXT })`.
- Charts: add a method to `ChartService` (reuse existing helpers/colours there) and attach with `AttachmentBuilder` + `.setImage("attachment://file.png")`.
- Put data logic in a service (`RaidAnalyticsService`, `HistoryService`, ...) not the command, so it is testable.
- Throw `UserError` subclasses for user-facing problems; don't hand-roll error replies.

## 2. Tests

Add/extend a suite in `src/test/services/` or `src/test/utils/` for any new service/util logic. Use `createMockClient` / `createMockDb` from `src/test/mocks/` and fixtures from `src/test/testFixtures.ts`.

## 3. Docs site

- `docs/commands-data.js`: add `{ name, desc, opts }` under the right category (`*` prefix = required option). Desc mirrors the command description.
- `docs/llms.txt`: add a `- /name: ...` line in the matching section.
- `docs/index.html`: only if the command belongs in a feature chip list.

## 4. Verify and report

Run `bun test`, `bunx tsc --noEmit`, `bun run lint`. Add a line under the next version in `CHANGELOG.md` (or tell the user it's pending for the `release` skill). Remind the user that `bun run deploy` is needed for Discord to see new/changed command definitions — do not run it yourself.

If the command should also be postable on a timer, continue with the `schedulable-command` skill.
