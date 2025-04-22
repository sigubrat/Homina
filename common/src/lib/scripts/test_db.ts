// Test database connection

import { dbHandler } from "@/lib/db_handler";

const test = await dbHandler.isReady();

if (test.isSuccess) {
    console.log("Database is ready.");
} else {
    console.error("Test of database failed with error: ", test.message);
}

process.exit(0);
