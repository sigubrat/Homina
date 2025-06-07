import { QueryInterface, DataTypes } from "sequelize";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.addColumn("GuildMembers", "playerToken", {
        type: DataTypes.STRING,
        allowNull: true,
    });

    await queryInterface.addColumn("GuildMembers", "lastAccessed", {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
    });

    // Set all existing rows to NOW() for lastAccessed
    await queryInterface.sequelize.query(
        'UPDATE "GuildMembers" SET "lastAccessed" = NOW() WHERE "lastAccessed" IS NULL;'
    );

    // Change the column to NOT NULL with default
    await queryInterface.changeColumn("GuildMembers", "lastAccessed", {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    });
}

export async function down({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.removeColumn("GuildMembers", "playerToken");
    await queryInterface.removeColumn("GuildMembers", "lastAccessed");
}
