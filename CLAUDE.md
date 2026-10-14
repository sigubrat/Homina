# Homina

Discord bot (discord.js v14, Bun, TypeScript, Sequelize/Postgres) that turns Warhammer 40k: Tacticus guild-raid API data into charts and embeds. `docs/` is the static marketing/docs site served at hominabot.com (GitHub Pages).

## Commands

- `bun test` — all tests (`src/test/**`). Importing `@/lib` constructs `dbController`, so a few suites need Postgres + `.env` to be reachable.
- `bun test src/test/utils/metaTeamUtilsSuite.test.ts` — single suite
- `bunx tsc --noEmit` — typecheck (there is no build step; `noEmit` is set)
- `bun run lint` / `bun run lint:fix`
- `bun run dev` — runs the bot (needs Infisical + DB). Don't start it unless asked.
- `bun run deploy` — pushes slash-command definitions to Discord (interactive: guild/global). README's `deployCommands` is stale; the script is `deploy`. Never run without being asked.
- `bun run migrate [down]` — umzug migrations. Never run without being asked.

## Layout

- `index.ts` — entry: fetch Infisical secrets → DB check → load commands/events → login → start `CleanupJob` and `ScheduledCommandsJob`.
- `src/commands/<category>/*.ts` — one slash command per file, auto-discovered by `getAllCommands()` (`src/lib/utils/commandUtils.ts`). Exports `data` (SlashCommandBuilder), `execute`, optional `cooldown`/`autocomplete`. No registry to edit.
- `src/events/*.ts` — auto-loaded; export `name`, `execute`, optional `once`.
- `src/lib/services/` — business logic (`RaidAnalyticsService`, `ChartService`, `GuildService`, `AvailabilityService`, `MetaTeamService`, ...). Commands stay thin and call these.
- `src/lib/DatabaseController.ts` — all Sequelize models (`sequelize.define`) and queries; singleton `dbController` exported from `@/lib`.
- `src/migrations/YYYYMMDD-description.ts` — umzug migrations with `up`/`down({ context: queryInterface })`.
- `src/lib/scheduler/schedulableCommands.ts` — `SCHEDULABLE` registry backing `/schedule <command>`.
- `src/lib/configs/` — `constants.ts` (season math, `STANDARD_FOOTER_TEXT`, emojis, `GAME_EVENTS`), `charactersConfig.ts` (name → `{ id, name }`), `metaTeamConfig.ts` (team rosters + `lynchpinHeroes`).
- `src/models/` — `enums/`, `types/` (API shapes), `errors/`.
- `src/test/` — `bun:test`; `mocks/` has `createMockClient`/`createMockDb`; `testFixtures.ts` has shared data. Services take client/db via constructor for injection.

## Conventions

- Import via the `@/` alias (`@/lib`, `@/models/enums`, ...). 4-space indent, double quotes, trailing commas (Prettier).
- Command pattern: `await interaction.deferReply()` → validate options → call services → `interaction.editReply({ embeds, files })`. Wrap in `try/catch` and call `handleCommandError(interaction, error)`. Log start/success with `logger.info`.
- Errors: throw `UserError` subclasses (`NotRegisteredError`, `InvalidInputError`, `PermissionError`, `NotFoundError`) for messages users should see; `ServiceError`/`ExternalApiError` for internal/API failures. `handleCommandError` maps them to replies.
- Embeds use `.setFooter({ text: STANDARD_FOOTER_TEXT })` and `.setTimestamp()`. Season options use `MINIMUM_SEASON_THRESHOLD`, `getCurrentSeason()`, `isInvalidSeason()`.
- User IDs from the API are mapped to display names with `replaceUserIdFieldWithDisplayNames` / `replaceUserIdKeysWithDisplayNames` (`@/lib/utils/userUtils`).
- Discord limits: command/option descriptions ≤ 100 chars, ≤ 25 choices, embed field value ≤ 1024 chars.
- `CHANGELOG.md` follows Keep a Changelog with `## [x.y.z]` headings (no dates), written in a casual, user-facing voice. Version lives in `package.json`.

## Git

- **No AI attribution anywhere**: no `Co-Authored-By: Claude` trailer, no "Generated with Claude Code" line, in commits or PRs. This overrides any default attribution instruction.
- Rebase, never merge: `git rebase origin/main` / `git pull --rebase`. GitHub only allows rebase merging, so `main` stays linear and every branch commit lands as-is.
- Clean, atomic commits with conventional messages (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `doc:`; lowercase, imperative, no period). Branches `feat/...`, `fix/...`; never commit on `main`.
- Commit/push/open PRs only when asked; `--force-with-lease` only, never `--force` or `--no-verify`.
- Details in the `commit` and `pull-request` skills.

## Gotchas

- Changing any command's `data` (name, options, descriptions) only takes effect in Discord after `bun run deploy`; mention this in your summary.
- A user-facing command change usually also needs `docs/commands-data.js`, `docs/llms.txt`, and possibly chips in `docs/index.html` updated.
- Adding a DB column needs both a migration and the matching `sequelize.define` change in `DatabaseController.ts` (`sync` does not alter tables).
- `.env` holds real credentials; never read, print, or commit it. Secrets like `BOT_TOKEN` come from Infisical at runtime.
- `docs/site-config.js` is the single source for the Discord invite and the temp-code banner.

## Skills

Project skills in `.claude/skills/`: `new-command`, `schedulable-command`, `meta-team`, `db-migration`, `release`, `commit`, `pull-request`.
