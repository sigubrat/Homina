import { type QueryInterface } from "sequelize";

const INDEX_NAME = "scheduled_commands_unique_channel_command";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS "${INDEX_NAME}"`,
    );
}

export async function down() {
    // No-op: this legacy constraint blocked multi-schedule support and
    // shouldn't be re-added.
}
