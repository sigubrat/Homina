import { DataTypes, type QueryInterface } from "sequelize";

const TABLE_NAME = "guildPlayerMetadata";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes(TABLE_NAME)) {
        await queryInterface.createTable(TABLE_NAME, {
            userId: {
                type: DataTypes.STRING,
                allowNull: false,
                primaryKey: true,
            },
            guildId: {
                type: DataTypes.STRING,
                allowNull: false,
                primaryKey: true,
            },
            nickname: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            playerToken: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                defaultValue: DataTypes.NOW,
            },
        });
    }

    const existingIndexes = (await queryInterface.showIndex(TABLE_NAME)) as {
        name: string;
    }[];
    const existingNames = new Set(existingIndexes.map((idx) => idx.name));

    if (!existingNames.has("guild_player_metadata_guild_id")) {
        await queryInterface.addIndex(TABLE_NAME, ["guildId"], {
            name: "guild_player_metadata_guild_id",
        });
    }
}

export async function down({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.dropTable(TABLE_NAME);
}
