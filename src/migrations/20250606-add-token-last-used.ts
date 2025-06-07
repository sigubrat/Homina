import { QueryInterface, DataTypes } from "sequelize";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    // 1. Add the column as nullable
    await queryInterface.addColumn("discordApiTokenMappings", "tokenLastUsed", {
        type: DataTypes.DATE,
        allowNull: true,
    });
    // 2. Set all existing rows to NOW()
    await queryInterface.sequelize.query(
        'UPDATE "discordApiTokenMappings" SET "tokenLastUsed" = NOW() WHERE "tokenLastUsed" IS NULL;'
    );
    // 3. Change the column to NOT NULL with default
    await queryInterface.changeColumn(
        "discordApiTokenMappings",
        "tokenLastUsed",
        {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        }
    );
}

export async function down({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.removeColumn(
        "discordApiTokenMappings",
        "tokenLastUsed"
    );
}
