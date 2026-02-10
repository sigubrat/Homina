import { QueryInterface, DataTypes } from "sequelize";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.dropTable("GuildMembers");
}

export async function down({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.createTable("GuildMembers", {
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        guildId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        playerToken: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        lastAccessed: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    });
}
