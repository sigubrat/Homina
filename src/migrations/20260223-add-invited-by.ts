import { QueryInterface, DataTypes } from "sequelize";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.addColumn("discordApiTokenMappings", "invitedBy", {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    });
}

export async function down({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.removeColumn("discordApiTokenMappings", "invitedBy");
}
