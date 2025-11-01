export interface DbTestResult {
    isSuccess: boolean;
    message?: string;
}

/**
 * Validates that all required environment variables are set.
 *
 * Checks the provided list of environment variable names and ensures each one
 * exists in `process.env`. If any are missing, logs an error message listing
 * the missing variables and exits the process with a non-zero status code.
 *
 * @param requiredVars - An array of environment variable names to validate.
 *
 * @throws Exits the process with code 1 if any required environment variables are missing.
 */
export function validateEnvVars(requiredVars: string[]): void {
    const missingVars = requiredVars.filter((varName) => !process.env[varName]);
    if (missingVars.length > 0) {
        console.error(
            `Missing environment variables: ${missingVars.join(
                ", "
            )}. Please ensure all required variables are set.`
        );
        process.exit(1);
    }
}
