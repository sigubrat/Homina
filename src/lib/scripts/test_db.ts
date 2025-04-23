// Test database connection

import { dbController } from "@/lib/DatabaseController";

const test = await dbController.isReady();

if (test.isSuccess) {
    console.log("Database is ready.");
} else {
    console.error("Test of database failed with error: ", test.message);
}

process.exit(0);
