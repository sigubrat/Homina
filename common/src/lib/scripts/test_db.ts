// Test database connection

import { isDbReady } from "../db_utils";

const test = await isDbReady();

if (test.isSuccess) {
    console.log("Database is ready.");
} else {
    console.error("Test of database failed with error: ", test.message);
}

process.exit(0);
