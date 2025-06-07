// filepath: src/lib/scripts/migrate.ts
import { Umzug, SequelizeStorage } from "umzug";
import { dbController } from "../DatabaseController"; // adjust import as needed

const res = await dbController.isReady();
if (!res) {
    console.error("Database is not ready. Exiting migration script.");
    process.exit(1);
}

const seq = dbController.getSequelizeInstance();

const umzug = new Umzug({
    migrations: { glob: "src/migrations/*.ts" },
    context: seq.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize: seq }),
    logger: console,
});

// Get migration direction from command line args (default to 'up')
const direction = process.argv[2] === "down" ? "down" : "up";

if (direction === "up") {
    umzug
        .up()
        .then(() => {
            console.log("Migrations complete");
            process.exit(0);
        })
        .catch((err) => {
            console.error("Migration error:", err);
            process.exit(1);
        });
} else {
    umzug
        .down()
        .then(() => {
            console.log("Migration reverted");
            process.exit(0);
        })
        .catch((err) => {
            console.error("Migration revert error:", err);
            process.exit(1);
        });
}
