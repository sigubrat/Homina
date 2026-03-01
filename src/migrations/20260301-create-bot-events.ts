import type { QueryInterface } from "sequelize";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "botEvents" (
            "id" SERIAL PRIMARY KEY,
            "eventType" VARCHAR(255) NOT NULL,
            "eventName" VARCHAR(255),
            "metadata" JSONB,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS "bot_events_event_type_created_at"
        ON "botEvents" ("eventType", "createdAt")
    `);

    await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS "bot_events_event_type_event_name_created_at"
        ON "botEvents" ("eventType", "eventName", "createdAt")
    `);

    await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS "bot_events_created_at"
        ON "botEvents" ("createdAt")
    `);
}

export async function down({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.dropTable("botEvents");
}
