import { DataTypes, type QueryInterface } from "sequelize";

export async function up({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes("botEvents")) {
        await queryInterface.createTable("botEvents", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            eventType: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            eventName: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            metadata: {
                type: DataTypes.JSONB,
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

    // Fetch existing index names so we only create what's missing
    const existingIndexes = (await queryInterface.showIndex("botEvents")) as {
        name: string;
    }[];
    const existingNames = new Set(existingIndexes.map((idx) => idx.name));

    if (!existingNames.has("bot_events_event_type_created_at")) {
        await queryInterface.addIndex("botEvents", ["eventType", "createdAt"], {
            name: "bot_events_event_type_created_at",
        });
    }

    if (!existingNames.has("bot_events_event_type_event_name_created_at")) {
        await queryInterface.addIndex(
            "botEvents",
            ["eventType", "eventName", "createdAt"],
            { name: "bot_events_event_type_event_name_created_at" },
        );
    }

    if (!existingNames.has("bot_events_created_at")) {
        await queryInterface.addIndex("botEvents", ["createdAt"], {
            name: "bot_events_created_at",
        });
    }
}

export async function down({
    context: queryInterface,
}: {
    context: QueryInterface;
}) {
    await queryInterface.dropTable("botEvents");
}
