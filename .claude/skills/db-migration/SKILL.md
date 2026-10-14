---
name: db-migration
description: Add or change a Homina database table, column, or index — writes the umzug migration and updates the Sequelize model and queries in DatabaseController. Use whenever persisted data shape changes.
---

# Database change

Homina uses Sequelize models defined inline in `src/lib/DatabaseController.ts` and umzug migrations in `src/migrations/` (run by `src/lib/scripts/migrate.ts`, glob `src/migrations/*.ts`, ordered by filename). `sequelize.sync()` only creates missing tables; it never alters existing ones, so schema changes always need a migration.

## 1. Migration file

`src/migrations/<YYYYMMDD>-<kebab-description>.ts`, dated today. Shape (see `20260702-create-scheduled-commands.ts`, `20260706-drop-schedule-unique-guild-command.ts`):

```ts
import { DataTypes, type QueryInterface } from "sequelize";

export async function up({ context: queryInterface }: { context: QueryInterface }) {
    await queryInterface.addColumn("tableName", "columnName", {
        type: DataTypes.STRING,
        allowNull: true,
    });
}

export async function down({ context: queryInterface }: { context: QueryInterface }) {
    await queryInterface.removeColumn("tableName", "columnName");
}
```

- Always write a real `down`.
- Make `up` safe on existing production rows (nullable or with `defaultValue`; backfill in the same migration if needed).
- Use `IF EXISTS` / `IF NOT EXISTS` in raw SQL when dropping/creating indexes.

## 2. Model + queries

Update the matching `this.sequelize.define(...)` in `DatabaseController.ts` so the model mirrors the migrated schema, then add/adjust query methods there. Sensitive values (API tokens) go through `CryptoService` — follow the existing token methods.

If tests mock the db, extend `src/test/mocks/mockDbController.ts` with the new methods.

## 3. Finish

`bunx tsc --noEmit`, `bun test`. Do **not** run `bun run migrate` — tell the user it must be run (locally and on prod) before deploying the code.
