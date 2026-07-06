import { type QueryInterface } from "sequelize";

const TABLE_NAME = "scheduledCommands";
const INDEX_NAME = "scheduled_commands_unique_guild_command";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS "${INDEX_NAME}"`,
    );
}

export async function down({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.addIndex(TABLE_NAME, ["guildId", "commandName"], {
        name: INDEX_NAME,
        unique: true,
    });
}
