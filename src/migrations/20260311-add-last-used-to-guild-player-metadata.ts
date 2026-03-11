import { DataTypes, type QueryInterface } from "sequelize";

const TABLE_NAME = "guildPlayerMetadata";
const COLUMN_NAME = "lastUsed";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    const tableDescription = await queryInterface.describeTable(TABLE_NAME);
    if (!(COLUMN_NAME in tableDescription)) {
        await queryInterface.addColumn(TABLE_NAME, COLUMN_NAME, {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        });
    }
}

export async function down({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.removeColumn(TABLE_NAME, COLUMN_NAME);
}
