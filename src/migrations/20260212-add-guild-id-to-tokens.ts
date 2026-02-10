import { QueryInterface, DataTypes } from "sequelize";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.addColumn("discordApiTokenMappings", "guildId", {
        type: DataTypes.STRING,
        allowNull: true,
    });
}

export async function down({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.removeColumn("discordApiTokenMappings", "guildId");
}
