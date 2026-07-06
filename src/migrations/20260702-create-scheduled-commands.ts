import { DataTypes, type QueryInterface } from "sequelize";

const TABLE_NAME = "scheduledCommands";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes(TABLE_NAME)) {
        await queryInterface.createTable(TABLE_NAME, {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            guildId: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            discordGuildId: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            channelId: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            commandName: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            optionsJson: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            intervalHours: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            ownerUserId: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            nextRunAt: {
                type: DataTypes.DATE,
                allowNull: false,
            },
            lastRunAt: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            lastStatus: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            lastError: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            pausedReason: {
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

    if (!existingNames.has("scheduled_commands_next_run")) {
        await queryInterface.addIndex(
            TABLE_NAME,
            ["nextRunAt", "pausedReason"],
            {
                name: "scheduled_commands_next_run",
            },
        );
    }

    if (!existingNames.has("scheduled_commands_unique_guild_command")) {
        await queryInterface.addIndex(TABLE_NAME, ["guildId", "commandName"], {
            name: "scheduled_commands_unique_guild_command",
            unique: true,
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
